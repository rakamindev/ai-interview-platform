# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      # Always 200 with the report's state. 404 only when no report was started.
      def show
        return report_not_started if @portfolio.nil?

        json_response(portfolio: Portfolios::ReportPresenter.new(@portfolio).as_json)
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio

        return report_not_started if portfolio.nil?

        unless Portfolios::ReportPresenter.new(portfolio).can_retry?
          return json_error("Trying again can't help this report", :unprocessable_entity, code: "not_retryable")
        end

        portfolio.update!(generation_status: "pending", generation_error: nil, failure_kind: nil)
        PortfolioGeneratorWorker.perform_async(@session.id)

        json_response(
          message:   "Portfolio generation queued",
          portfolio: Portfolios::ReportPresenter.new(portfolio).as_json
        )
      end

      # GET /api/v1/portfolios/:id/export
      def export
        format = params.fetch(:format, "json")

        unless %w[pdf json].include?(format)
          return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity)
        end

        report = Portfolios::ReportPresenter.new(@portfolio)
        return report_not_complete(report) unless report.exportable?

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
        export_data = build_export_json(report, vacancy_id)

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

        report = Portfolios::ReportPresenter.new(portfolio)
        return report_not_complete(report) unless report.exportable?

        FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)&.destroy
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)

        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
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

        report = Portfolios::ReportPresenter.new(portfolio)
        return report_not_complete(report) unless report.exportable?

        # Return cached report if it exists and portfolio has no new overrides
        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if existing
          return json_response(report: fit_gap_json(existing))
        end

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
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
        if @session
          @portfolio = @session.portfolio
        else
          @portfolio = Portfolio.find(params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # Exports and fit/gap only use a complete report, with every skill accounted for.
      def report_not_complete(report)
        json_error("Only a complete report can be used (this one is #{report.state})",
                   :unprocessable_entity, code: "report_not_complete")
      end

      def report_not_started
        json_error("No report has been started for this session", :not_found, code: "report_not_started")
      end

      def fit_gap_json(report)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at
        }
      end

      def build_export_json(report, vacancy_id = nil)
        portfolio = report.as_json
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio
        }

        if vacancy_id.present?
          fit_gap = FitGapReport.find_by(portfolio_id: portfolio[:id], vacancy_id: vacancy_id)
          data[:fit_gap_report] = fit_gap ? fit_gap_json(fit_gap) : nil
        end

        data
      end
    end
  end
end
