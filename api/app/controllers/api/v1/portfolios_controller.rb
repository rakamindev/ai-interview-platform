# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        return render json: { status: 'generating' }, status: :accepted if @portfolio.nil? || @portfolio.generating?

        if @portfolio.failed?
          return json_response(
            portfolio: portfolio_json(@portfolio),
            error: @portfolio.generation_error
          )
        end

        json_response(portfolio: portfolio_json(@portfolio))
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio

        return json_error('No portfolio found for this session', :not_found) if portfolio.nil?

        unless portfolio.failed?
          return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity)
        end

        portfolio.update!(generation_status: 'pending', generation_error: nil)
        PortfolioGeneratorWorker.perform_async(@session.id)

        json_response(
          message: 'Portfolio generation queued',
          portfolio: portfolio_json(portfolio)
        )
      end

      # GET /api/v1/portfolios/:id/export
      def export
        format = params.fetch(:format, 'json')

        return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity) unless %w[pdf json].include?(format)

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})",
                            :unprocessable_entity)
        end

        if format == 'pdf'
          vacancy = params[:vacancy_id].present? ? Vacancy.find_by(id: params[:vacancy_id]) : nil
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call

          return send_data pdf_data,
                           filename: "portfolio-#{@portfolio.id}.pdf",
                           type: 'application/pdf',
                           disposition: 'attachment'
        end

        # JSON export
        vacancy_id = params[:vacancy_id]
        export_data = build_export_json(@portfolio, vacancy_id)

        send_data export_data.to_json,
                  filename: "portfolio-#{@portfolio.id}.json",
                  type: 'application/json',
                  disposition: 'attachment'
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = scoped_portfolio!(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error('vacancy_id is required', :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error('Vacancy not found', :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)&.destroy
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)

        render json: { status: 'generating', message: 'Fit/gap report regeneration queued' }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = scoped_portfolio!(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error('vacancy_id is required', :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error('Vacancy not found', :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Return cached report only when no assessor overrides were applied
        # after the report was generated (overrides feed into the fit/gap output).
        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        return json_response(report: fit_gap_json(existing)) if existing && !stale_report?(existing, portfolio)

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        render json: { status: 'generating', message: 'Fit/gap report generation queued' }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = scoped_portfolio!(params[:id])
        report    = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: params[:vacancy_id])

        return json_error('Fit/gap report not found', :not_found) if report.nil?

        json_response(report: fit_gap_json(report))
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error('Session not found', :not_found)
      end

      def set_portfolio
        # Routes use :id for both session-based and direct portfolio lookups.
        # Sessions are tenant-scoped (TenantScoped concern), so resolving the
        # portfolio through the session keeps reads tenant-isolated.
        @portfolio = if @session
                       @session.portfolio
                     else
                       scoped_portfolio!(params[:id])
                     end
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # Resolves a portfolio that belongs to the CURRENT tenant only.
      # Portfolio itself has no tenant_id, but its session does; joining through
      # the session prevents cross-tenant reads via the direct :id route
      # (a P0 UU PDP / data-isolation gap that previously allowed reading any
      # portfolio by guessing an id).
      def scoped_portfolio!(id)
        Portfolio
          .joins(:session)
          .where(sessions: { tenant_id: current_tenant_id })
          .find(id)
      end

      def portfolio_json(portfolio)
        summary = Evaluations::Summary.new(portfolio).call
        {
          id: portfolio.id,
          session_id: portfolio.session_id,
          candidate_id: portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at: portfolio.generated_at,
          generation_error: portfolio.generation_error,
          evaluation: summary,
          skills: portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides: portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          is_discovered: skill.is_discovered,
          ai_level: skill.ai_level,
          ai_confidence: skill.ai_confidence,
          evidence: skill.evidence_quotes,
          counter_evidence: skill.counter_evidence_quotes,
          competency_summary: skill.competency_summary
        }
      end

      def override_json(override)
        {
          id: override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level: override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by: override.overridden_by,
          overridden_at: override.overridden_at
        }
      end

      def fit_gap_json(report)
        {
          id: report.id,
          portfolio_id: report.portfolio_id,
          vacancy_id: report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at: report.generated_at
        }
      end

      def stale_report?(report, portfolio)
        portfolio.assessor_overrides
                 .where('overridden_at > ?', report.generated_at)
                 .exists?
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio: portfolio_json(portfolio)
        }

        if vacancy_id.present?
          report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy_id)
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end

        data
      end
    end
  end
end
