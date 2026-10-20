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

        unless portfolio.failed? || (portfolio.complete? && portfolio.generation_error.present?)
          return json_error("Portfolio can only be regenerated when status is 'failed' or a completed result has a generation error", :unprocessable_entity)
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
          vacancy = params[:vacancy_id].present? ? Authorization::PortfolioAccess.find_vacancy!(params[:vacancy_id], tenant_id: current_tenant_id) : nil
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
                  filename: "portfolio-#{@portfolio.id}.json",
                  type: "application/json",
                  disposition: "attachment"
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = Authorization::PortfolioAccess.find_portfolio!(params[:id], tenant_id: current_tenant_id)
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Authorization::PortfolioAccess.find_vacancy!(vacancy_id, tenant_id: current_tenant_id)

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Keep the previous report readable until the engine replacement lands.
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = Authorization::PortfolioAccess.find_portfolio!(params[:id], tenant_id: current_tenant_id)

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Authorization::PortfolioAccess.find_vacancy!(vacancy_id, tenant_id: current_tenant_id)

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        existing = Authorization::PortfolioAccess.find_report(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id,
          tenant_id: current_tenant_id
        )
        return json_response(report: fit_gap_json(existing)) if existing

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = Authorization::PortfolioAccess.find_portfolio!(params[:id], tenant_id: current_tenant_id)
        report = Authorization::PortfolioAccess.find_report(
          portfolio_id: portfolio.id,
          vacancy_id: params[:vacancy_id],
          tenant_id: current_tenant_id
        )

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
        @portfolio =
          if @session
            Authorization::PortfolioAccess.find_for_session!(@session.id, tenant_id: current_tenant_id)
          else
            Authorization::PortfolioAccess.find_portfolio!(params[:id], tenant_id: current_tenant_id)
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
          id:                 skill.id,
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          is_discovered:      skill.is_discovered,
          ai_level:           skill.ai_level,
          ai_confidence:      skill.ai_confidence,
          evidence:           skill.evidence_quotes,
          competency_summary: skill.competency_summary
        }
      end

      def override_json(override)
        {
          id:                 override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:           override.ai_level,
          override_level:     override.override_level,
          assessor_notes:     override.assessor_notes,
          overridden_by:      override.overridden_by,
          overridden_at:      override.overridden_at
        }
      end

      def fit_gap_json(report)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          override_context:  report.override_context,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at
        }
      end




      def consent_export_json(session)
        {
          accepted_at: session.consent_accepted_at,
          version:     session.consent_version,
          declined_at: session.consent_declined_at
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio),
          # A hiring decision can be traced back to the consent that was recorded
          # for the session this portfolio belongs to.
          consent:     consent_export_json(portfolio.session)
        }
        if vacancy_id.present?
          report = Authorization::PortfolioAccess.find_report(
            portfolio_id: portfolio.id,
            vacancy_id: vacancy_id,
            tenant_id: current_tenant_id
          )
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end

        data
      end
    end
  end
end
