# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session, only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        if @portfolio.nil? || @portfolio.generation_status.in?(%w[pending generating])
          return render json: { status: "generating" }, status: :accepted
        end

        if @portfolio.failed?
          return json_response(
            portfolio: portfolio_json(@portfolio),
            error: "Portfolio generation failed. Please retry."
          )
        end

        json_response(portfolio: portfolio_json(@portfolio))
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio
        return json_error("No portfolio found for this session", :not_found) unless portfolio
        return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity) unless portfolio.failed?

        portfolio.update!(generation_status: "pending", generation_error: nil)
        job_id = PortfolioGeneratorWorker.perform_async(@session.id)
        unless job_id
          portfolio.update!(generation_status: "failed", generation_error: "Portfolio generation could not be queued")
          return json_error("Portfolio generation could not be queued. Please retry.", :service_unavailable)
        end

        json_response(message: "Portfolio generation queued", portfolio: portfolio_json(portfolio))
      end

      # GET /api/v1/portfolios/:id/export
      def export
        format = params.fetch(:format, "json")
        return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity) unless %w[pdf json].include?(format)
        return json_error("Portfolio is not ready for export", :unprocessable_entity) unless @portfolio&.complete?

        vacancy = nil
        if params[:vacancy_id].present?
          vacancy = find_vacancy!(params[:vacancy_id])
          return unless vacancy
          unless @portfolio.session.tenant_id == vacancy.tenant_id
            return json_error("Vacancy not found", :not_found)
          end

          report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
          return json_error("Fit/gap report is not ready for export", :unprocessable_entity) unless report&.complete?
        end

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call
          return send_data pdf_data,
                           filename: "portfolio-#{@portfolio.id}.pdf",
                           type: "application/pdf",
                           disposition: "attachment"
        end

        send_data build_export_json(@portfolio, vacancy&.id).to_json,
                  filename: "portfolio-#{@portfolio.id}.json",
                  type: "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio = find_portfolio_for_tenant!(params[:id])
        return unless portfolio
        vacancy = find_vacancy!(params[:vacancy_id])
        return unless vacancy
        return json_error("Portfolio is not ready", :unprocessable_entity) unless portfolio.complete?

        report = FitGap::ReportScheduler.enqueue(portfolio: portfolio, vacancy: vacancy, force: true)
        return json_error("Report generation could not be scheduled. Please retry.", :service_unavailable) unless report

        render json: {
          status: report.generation_status,
          report: fit_gap_json(report),
          message: "Fit/gap report regeneration requested"
        }, status: :accepted
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = find_portfolio_for_tenant!(params[:id])
        return unless portfolio

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        vacancy = find_vacancy!(vacancy_id)
        return unless vacancy
        return json_error("Portfolio is not ready", :unprocessable_entity) unless portfolio.complete?

        report = FitGap::ReportScheduler.enqueue(portfolio: portfolio, vacancy: vacancy)
        return json_error("Report generation could not be scheduled. Please retry.", :service_unavailable) unless report
        return json_response(report: fit_gap_json(report)) if report.complete?

        render json: { status: report.generation_status, report: fit_gap_json(report) }, status: :accepted
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = find_portfolio_for_tenant!(params[:id])
        return unless portfolio
        vacancy = find_vacancy!(params[:vacancy_id])
        return unless vacancy

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
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
        @portfolio = if @session
                       @session.portfolio
                     else
                       find_portfolio_for_tenant!(params[:id])
                     end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def find_portfolio_for_tenant!(id)
        Portfolio.joins(:session)
                 .where(sessions: { tenant_id: current_tenant_id })
                 .find(id)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
        nil
      end

      def find_vacancy!(id)
        if id.blank?
          json_error("vacancy_id is required", :unprocessable_entity)
          return nil
        end

        vacancy = Vacancy.find_by(id: id, tenant_id: current_tenant_id)
        return vacancy if vacancy

        json_error("Vacancy not found", :not_found)
        nil
      end

      def portfolio_json(portfolio)
        {
          id: portfolio.id,
          session_id: portfolio.session_id,
          candidate_id: portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at: portfolio.generated_at,
          generation_error: portfolio.failed? ? "Portfolio generation failed. Please retry." : nil,
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
          generation_status: report.generation_status,
          generation_error: report.failed? ? "Report generation failed. Please retry." : nil,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at: report.generated_at
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = { exported_at: Time.current.iso8601, portfolio: portfolio_json(portfolio) }
        if vacancy_id.present?
          report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy_id)
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end
        data
      end
    end
  end
end
