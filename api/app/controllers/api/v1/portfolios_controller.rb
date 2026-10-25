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

        vacancy, report, stale_export = fit_gap_export_context
        return if performed?

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(
            portfolio: @portfolio,
            vacancy:,
            fit_gap_report: report,
            stale: stale_export
          ).call

          return send_data pdf_data,
                           filename:    "portfolio-#{@portfolio.id}.pdf",
                           type:        "application/pdf",
                           disposition: "attachment"
        end

        # JSON export
        export_data = build_export_json(@portfolio, report:, stale_export:)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}.json",
                  type:        "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = Portfolio.find(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGap::RegenerationCoordinator.request!(portfolio:, vacancy:, force: true)

        render json: {
          status: "generating",
          message: "Fit/gap report regeneration queued",
          report: fit_gap_json(report)
        }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = Portfolio.find(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if existing&.freshness == 'current'
          return json_response(report: fit_gap_json(existing))
        end

        report = FitGap::RegenerationCoordinator.request!(portfolio:, vacancy:)
        render json: {
          status: "generating",
          message: "Fit/gap report generation queued",
          report: fit_gap_json(report)
        }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = Portfolio.find(params[:id])
        report    = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: params[:vacancy_id])

        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        json_response(report: fit_gap_json(report))
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
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
        # Otherwise use current_tenant scope (TenantScoped default_scope)
        if @session
          @portfolio = @session.portfolio
        else
          @portfolio = Portfolio.find(params[:id])
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
          failure_reason:     portfolio_failure_reason(portfolio),
          skills:            portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides:         portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_failure_reason(portfolio)
        return nil unless portfolio.failed?
        return 'missing_assessment_skills' unless portfolio.session.assessment.assessment_skills.exists?
        return 'missing_coverage' unless portfolio.session.coverage_maps.exists?

        'generation_failed'
      end

      def portfolio_skill_json(skill)
        {
          id:                skill.id,
          skill_id:          skill.skill_id,
          skill_label:       skill.skill_label,
          is_discovered:     skill.is_discovered,
          ai_level:          skill.ai_level,
          ai_confidence:     skill.ai_confidence,
          evidence:          skill.evidence_items,
          evidence_status:   skill.evidence_status,
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
        freshness = report.freshness
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at,
          generation_status: report.generation_status,
          generation_error:  report.generation_error,
          freshness:          freshness,
          has_completed_report: report.completed_payload?
        }
      end

      def build_export_json(portfolio, report: nil, stale_export: false)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio),
          stale_export: stale_export
        }

        data[:fit_gap_report] = fit_gap_json(report).merge(stale_export:) if report

        data
      end

      def fit_gap_export_context
        return [nil, nil, false] if params[:vacancy_id].blank?

        vacancy = Vacancy.find_by(id: params[:vacancy_id])
        unless vacancy
          json_error("Vacancy not found", :not_found)
          return [nil, nil, false]
        end

        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
        unless report&.completed_payload?
          json_error("Fit/gap report is not ready for export", :conflict)
          return [vacancy, report, false]
        end

        freshness = report.freshness
        return [vacancy, report, false] if freshness == 'current'

        allow_stale = ActiveModel::Type::Boolean.new.cast(params[:allow_stale])
        return [vacancy, report, true] if freshness == 'failed' && allow_stale

        json_error(
          "Fit/gap report is #{freshness} and cannot be exported as current",
          :conflict,
          details: { freshness:, stale_export_allowed: freshness == 'failed' }
        )
        [vacancy, report, false]
      end
    end
  end
end
