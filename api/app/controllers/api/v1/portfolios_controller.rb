# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,          only: %i[show regenerate]
      before_action :set_portfolio,        only: %i[show export]
      before_action :set_tenant_portfolio, only: %i[fitgap regenerate_fitgap show_fitgap]

      # GET /api/v1/sessions/:id/portfolio
      def show
        if @portfolio.nil?
          return render json: { status: "unavailable", portfolio: nil }, status: :ok
        end

        if @portfolio.generating?
          if @portfolio.published_result?
            return json_response(
              {
                status:    "generating",
                portfolio: portfolio_json(@portfolio)
              },
              :accepted
            )
          else
            return render json: { status: "generating", portfolio: nil }, status: :accepted
          end
        end

        if @portfolio.failed?
          return json_response(
            status:     "failed",
            error:      safe_user_error(@portfolio.generation_error),
            error_code: "EVALUATION_FAILED",
            portfolio:  portfolio_json(@portfolio)
          )
        end

        if @portfolio.complete?
          if @portfolio.published_result?
            return json_response(portfolio: portfolio_json(@portfolio))
          else
            return render json: { status: "unavailable", portfolio: nil }, status: :ok
          end
        end

        if @portfolio.published_result?
          json_response(portfolio: portfolio_json(@portfolio))
        else
          render json: { status: "unavailable", portfolio: nil }, status: :ok
        end
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio

        if portfolio.nil?
          return json_error("No portfolio found for this session", :not_found)
        end

        state_error = nil
        already_generating = false
        previous_status = nil
        previous_generation_error = nil

        portfolio.with_lock do
          portfolio.reload

          if portfolio.generating?
            already_generating = true
          elsif !(portfolio.failed? || portfolio.complete?)
            state_error = "Portfolio can only be regenerated when status is 'failed' or 'complete'"
          else
            previous_status = portfolio.generation_status
            previous_generation_error = portfolio.generation_error
            portfolio.update!(generation_status: "generating", generation_error: nil)
          end
        end

        if already_generating
          return render json: { status: "generating", message: "Portfolio generation is already in progress" }, status: :accepted
        end

        if state_error
          return json_error(state_error, :unprocessable_entity)
        end

        begin
          PortfolioGeneratorWorker.perform_async(@session.id)
        rescue StandardError
          portfolio.with_lock do
            portfolio.reload
            if portfolio.generating?
              portfolio.update!(
                generation_status: previous_status,
                generation_error:  previous_generation_error
              )
            end
          end
          return json_error("Failed to queue generation. Please retry.", :service_unavailable)
        end

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

        unless @portfolio.complete? && @portfolio.published_result?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        vacancy = nil
        if params[:vacancy_id].present?
          vacancy = Vacancy.where(tenant_id: Current.tenant_id).find_by(id: params[:vacancy_id])
          return json_error("Vacancy not found", :not_found) unless vacancy
        end

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call

          return send_data pdf_data,
                           filename:    "portfolio-#{@portfolio.id}.pdf",
                           type:        "application/pdf",
                           disposition: "attachment"
        end

        # JSON export
        export_data = build_export_json(@portfolio, vacancy&.id)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}.json",
                  type:        "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        vacancy_id = params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.where(tenant_id: Current.tenant_id).find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless @portfolio.complete? && @portfolio.published_result?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)&.destroy
        FitGapGeneratorWorker.perform_async(@portfolio.id, vacancy.id)

        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.where(tenant_id: Current.tenant_id).find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless @portfolio.complete? && @portfolio.published_result?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        # Return cached report if it exists and portfolio has no new overrides
        existing = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
        if existing
          return json_response(report: fit_gap_json(existing))
        end

        FitGapGeneratorWorker.perform_async(@portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        vacancy = Vacancy.where(tenant_id: Current.tenant_id).find_by(id: params[:vacancy_id])
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless @portfolio.complete? && @portfolio.published_result?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)
        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        json_response(report: fit_gap_json(report))
      end

      private

      def set_session
        @session = Session.where(tenant_id: Current.tenant_id).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        if @session
          @portfolio = @session.portfolio
        else
          set_tenant_portfolio
        end
      end

      def set_tenant_portfolio
        session = Session.where(tenant_id: Current.tenant_id).joins(:portfolio).find_by!(portfolios: { id: params[:id] })
        @portfolio = session.portfolio
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def safe_user_error(raw_error)
        return nil if raw_error.blank?

        "Evaluation generation encountered an issue. Please retry."
      end

      def portfolio_json(portfolio)
        is_published = portfolio.published_result?

        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  safe_user_error(portfolio.generation_error),
          skills:            is_published ? portfolio.portfolio_skills.map(&method(:portfolio_skill_json)) : [],
          overrides:         is_published ? portfolio.assessor_overrides.map(&method(:override_json)) : []
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
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
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
