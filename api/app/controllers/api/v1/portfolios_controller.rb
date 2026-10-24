# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        Portfolios::GenerationManager.new(@portfolio).expire_stalled! if @portfolio
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

        Portfolios::GenerationManager.new(portfolio).expire_stalled!

        unless portfolio.failed? || portfolio.generation_error.present?
          return json_error("Portfolio can only be regenerated after a failure", :unprocessable_entity)
        end

        begin
          Portfolios::GenerationManager.new(portfolio).queue
        rescue Portfolios::GenerationManager::EnqueueError
          return json_error("Could not queue portfolio generation. Try again.", :service_unavailable)
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

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        vacancy = nil
        if params[:vacancy_id].present?
          vacancy = tenant_vacancies.find_by(id: params[:vacancy_id])
          return json_error("Vacancy not found", :not_found) unless vacancy

          state = FitGap::GenerationManager.new(portfolio: @portfolio, vacancy: vacancy).state
          if state[:report].nil? || state[:stale]
            return json_error("A current fit/gap report is required for this export", :conflict)
          end
        end

        if format == "pdf"
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
        portfolio  = tenant_portfolios.find(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = tenant_vacancies.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        state = FitGap::GenerationManager.new(portfolio: portfolio, vacancy: vacancy).queue(force: true)
        render json: fit_gap_state_json(state), status: :accepted
      rescue FitGap::GenerationManager::EnqueueError
        json_error("Could not queue fit/gap generation. Try again.", :service_unavailable)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = tenant_portfolios.find(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = tenant_vacancies.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        state = FitGap::GenerationManager.new(portfolio: portfolio, vacancy: vacancy).queue
        render json: fit_gap_state_json(state), status: state[:report] && !state[:stale] ? :ok : :accepted
      rescue FitGap::GenerationManager::EnqueueError
        json_error("Could not queue fit/gap generation. Try again.", :service_unavailable)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = tenant_portfolios.find(params[:id])
        vacancy = tenant_vacancies.find_by(id: params[:vacancy_id])
        return json_error("Vacancy not found", :not_found) unless vacancy

        state = FitGap::GenerationManager.new(portfolio: portfolio, vacancy: vacancy).state
        json_response(fit_gap_state_json(state))
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      private

      def set_session
        @session = Session.where(tenant_id: current_tenant_id).find(params[:id])
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
          generation_in_progress: portfolio.generation_attempt_token.present?,
          generated_at:      portfolio.generated_at,
          generation_error:  portfolio.generation_error,
          skills:            portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides:         portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def tenant_portfolios
        Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })
      end

      def tenant_vacancies
        Vacancy.where(tenant_id: current_tenant_id)
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
          skill_comparisons: report.skill_comparisons.map { |comparison| normalize_comparison(comparison) },
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at
        }
      end

      def fit_gap_state_json(state)
        {
          report: state[:report] && fit_gap_json(state[:report]),
          stale: state[:stale] || false,
          generation: state[:generation]
        }
      end

      def normalize_comparison(comparison)
        comparison = comparison.stringify_keys
        comparison['required_level'] ||= comparison['expected_level']
        comparison['is_override'] = comparison['overridden'] || false unless comparison.key?('is_override')
        comparison.except('expected_level', 'overridden')
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
