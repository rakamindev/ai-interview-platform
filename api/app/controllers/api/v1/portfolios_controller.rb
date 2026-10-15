# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[export fitgap regenerate_fitgap show_fitgap]

      # GET /api/v1/sessions/:id/portfolio
      def show
        portfolio = @session.portfolio

        if portfolio.nil? || portfolio.generating? || portfolio.pending?
          return render json: {
            status:                portfolio&.generation_status || "pending",
            generation_started_at: portfolio&.generation_started_at
          }, status: :accepted
        end

        if portfolio.failed?
          return json_response(
            portfolio: portfolio_json(portfolio),
            error: portfolio.generation_error
          )
        end

        json_response(portfolio: portfolio_json(portfolio))
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
      def regenerate_fitgap
        vacancy = find_vacancy(params[:vacancy_id])
        return if performed?

        unless @portfolio.complete?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)&.destroy
        FitGapGeneratorWorker.enqueue_once(@portfolio.id, vacancy.id)

        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        vacancy = find_vacancy(params.dig(:fitgap, :vacancy_id) || params[:vacancy_id])
        return if performed?

        unless @portfolio.complete?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        existing = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
        return json_response(report: fit_gap_json(existing, vacancy)) if existing

        FitGapGeneratorWorker.enqueue_once(@portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        vacancy = find_vacancy(params[:vacancy_id])
        return if performed?

        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
        return json_error("Fit/gap report not found", :not_found) if report.nil?

        json_response(report: fit_gap_json(report, vacancy))
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      # Portfolios are only reachable through a session of the current tenant;
      # a portfolio id from another organization is reported as not found.
      def set_portfolio
        @portfolio = Portfolio.visible_to_current_tenant.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def find_vacancy(vacancy_id)
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        Vacancy.find_by(id: vacancy_id) || json_error("Vacancy not found", :not_found)
      end

      def portfolio_json(portfolio)
        skills = portfolio.portfolio_skills.includes(:assessor_override).order(:is_discovered, :id)

        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  portfolio.generation_error,
          skills:            skills.map(&method(:portfolio_skill_json)),
          overrides:         skills.filter_map(&:assessor_override).map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        {
          id:                 skill.id,
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          is_discovered:      skill.is_discovered,
          rating_status:      skill.rating_status,
          ai_level:           skill.ai_level,
          ai_confidence:      skill.rated? ? skill.ai_confidence : nil,
          probe_count:        skill.probe_count,
          coverage_state:     skill.coverage_state,
          evidence:           skill.evidence_quotes,
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

      def fit_gap_json(report, vacancy = report.vacancy)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at,
          stale:             report.input_fingerprint != FitGap::Engine.fingerprint(report.portfolio, vacancy)
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio)
        }

        if vacancy_id.present?
          vacancy = Vacancy.find_by(id: vacancy_id)
          report = vacancy && FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
          data[:fit_gap_report] = report ? fit_gap_json(report, vacancy) : nil
        end

        data
      end
    end
  end
end
