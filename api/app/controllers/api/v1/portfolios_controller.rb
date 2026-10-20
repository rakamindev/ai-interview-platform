# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        if @portfolio.nil? || @portfolio.generating?
          return render json: { status: "generating" }, status: :accepted
        end

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

        if portfolio.nil?
          return json_error("No portfolio found for this session", :not_found)
        end

        unless portfolio.failed?
          return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity)
        end

        portfolio.update!(generation_status: "pending", generation_error: nil)
        PortfolioGeneratorWorker.perform_async(@session.id)

        json_response(
          message:   "Portfolio generation queued",
          portfolio: portfolio_json(portfolio)
        )
      end

      # GET /api/v1/portfolios/:id/export
      def export
        format = params.fetch(:format, "json")

        unless %w[pdf json].include?(format)
          return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity)
        end

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        if format == "pdf"
          vacancy = params[:vacancy_id].present? ? Vacancy.find_by(id: params[:vacancy_id]) : nil
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call

          return send_data pdf_data,
                           filename:    "portfolio-#{@portfolio.id}.pdf",
                           type:        "application/pdf",
                           disposition: "attachment"
        end

        # JSON export
        vacancy_id = params[:vacancy_id]
        export_data = build_export_json(@portfolio, vacancy_id)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}.json",
                  type:        "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      # Re-runs the narrative (e.g. after it failed). The comparison table is never removed.
      def regenerate_fitgap
        portfolio, vacancy = fitgap_context
        return unless portfolio

        report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
        report.update!(narrative_status: 'pending', narrative_digest: nil, generation_error: nil)
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)

        render json: { report: fit_gap_json(report) }, status: :accepted
      end

      # POST /api/v1/portfolios/:id/fitgap
      # Idempotent: returns the report immediately (comparison computed synchronously); only the
      # narrative is produced in the background, and only when it is not already up to date.
      def fitgap
        portfolio, vacancy = fitgap_context
        return unless portfolio

        report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).refresh_comparisons!
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) if report.narrative_pending?

        render json: { report: fit_gap_json(report) }, status: report.narrative_pending? ? :accepted : :ok
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = find_portfolio(params[:id])
        return json_error("Portfolio not found", :not_found) unless portfolio

        vacancy = Vacancy.find_by(id: params[:vacancy_id])
        report  = vacancy && FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        return json_error("Fit/gap report not found", :not_found) unless report

        json_response(report: fit_gap_json(report))
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        # Routes use :id for both session-based and direct portfolio lookups
        # If called from session context, look up via session
        @portfolio = @session ? @session.portfolio : find_portfolio(params[:id])
        json_error("Portfolio not found", :not_found) if @portfolio.nil? && !@session
      end

      # Portfolio has no tenant_id of its own: it is only reachable through its Session, which is
      # tenant-scoped. Always look portfolios up through this so one org can never read another's.
      def find_portfolio(id)
        Portfolio.where(session_id: Session.select(:id)).find_by(id: id)
      end

      def halt(message, status)
        json_error(message, status)
        nil
      end

      # Shared guard for the fit/gap write endpoints. Renders and returns nil when it cannot proceed.
      def fitgap_context
        portfolio = find_portfolio(params[:id])
        return halt("Portfolio not found", :not_found) unless portfolio

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return halt("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return halt("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return halt("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        [portfolio, vacancy]
      end

      def portfolio_json(portfolio)
        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  portfolio.generation_error,
          skills:            portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides:         portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        {
          id:                skill.id,
          skill_id:          skill.skill_id,
          skill_label:       skill.skill_label,
          is_discovered:     skill.is_discovered,
          ai_level:          skill.ai_level,
          ai_confidence:     skill.ai_confidence,
          evidence:          skill.evidence_quotes,
          competency_summary: skill.competency_summary
        }
      end

      def override_json(override)
        {
          id:             override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:       override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by:  override.overridden_by,
          overridden_at:  override.overridden_at
        }
      end

      def fit_gap_json(report)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.comparisons_for_api,
          summary:           report.summary_for_api,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          narrative_status:  report.narrative_status,
          generated_at:      report.generated_at
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio)
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
