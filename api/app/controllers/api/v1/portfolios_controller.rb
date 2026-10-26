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

      # GET /api/v1/portfolios/:id/vacancy_matches
      # F18: one interview, many possible roles. Ranks this company's vacancies by how much of each
      # the interview covered, then by total shortfall, using the same rules as the fit/gap report.
      def vacancy_matches
        portfolio = tenant_portfolios.find(params[:id])

        matches = Vacancy.includes(:vacancy_skills).map do |vacancy|
          comparisons = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).skill_comparisons
          summary     = FitGapReport.new(skill_comparisons: comparisons.map(&:deep_stringify_keys)).summary
          shortfall   = comparisons.sum { |c| c[:delta].to_i.negative? ? -c[:delta] : 0 }

          { vacancy_id: vacancy.id, role_title: vacancy.role_title, summary: summary, shortfall: shortfall }
        end

        ranked = matches.sort_by { |m| [-m[:summary]['coverage_pct'], m[:shortfall], m[:role_title].downcase] }
        json_response(matches: ranked)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = tenant_portfolios.find(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGapReport.request_generation!(portfolio: portfolio, vacancy: vacancy, force: true)
        render json: { status: "generating", message: "Fit/gap report regeneration queued", report: fit_gap_json(report) },
               status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = tenant_portfolios.find(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Idempotent: a ready report is returned, a generating one is not queued again,
        # a missing or failed one is queued once.
        report = FitGapReport.request_generation!(portfolio: portfolio, vacancy: vacancy)
        return json_response(report: fit_gap_json(report)) if report.ready?

        render json: { status: "generating", message: "Fit/gap report generation queued", report: fit_gap_json(report) },
               status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = tenant_portfolios.find(params[:id])
        report    = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: params[:vacancy_id])

        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        json_response(report: fit_gap_json(report))
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      private

      # F1: every portfolio lookup by id is limited to the caller's company.
      def tenant_portfolios
        Portfolio.owned_by_tenant(current_tenant_id)
      end

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        # Routes use :id for both session-based and direct portfolio lookups
        # If called from session context, look up via session
        if @session
          @portfolio = @session.portfolio
        else
          @portfolio = tenant_portfolios.find(params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
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
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at,
          status:            report.status,
          narrative_source:  report.narrative_source,
          error_message:     report.error_message,
          summary:           report.summary
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
