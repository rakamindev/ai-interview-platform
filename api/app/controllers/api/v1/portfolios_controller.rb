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

        return export_pdf if format == "pdf"

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
        request_narrative(force: true)
      end

      # POST /api/v1/portfolios/:id/fitgap
      # Requests the AI narrative. Comparisons never need generating; they are
      # computed on read. Only one narrative job runs per portfolio and vacancy.
      def fitgap
        request_narrative(force: false)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        with_fitgap_inputs(params[:vacancy_id]) do |portfolio, vacancy|
          json_response(report: FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).as_json)
        end
      end

      private

      # A rendering error answers with a code and a safe message; the log keeps
      # the error class only, because the message can contain candidate text.
      def export_pdf
        vacancy = params[:vacancy_id].present? ? Vacancy.find_by(id: params[:vacancy_id]) : nil
        pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call

        send_data pdf_data,
                  filename:    "portfolio-#{@portfolio.id}.pdf",
                  type:        "application/pdf",
                  disposition: "attachment"
      rescue StandardError => e
        Rails.logger.error("[PortfoliosController] PDF export failed portfolio=#{@portfolio.id} error=#{e.class}")
        render json: { errors: [{ status: 500, code: "pdf_render_failed",
                                  message: "The PDF could not be created. Try again or export JSON instead." }] },
               status: :internal_server_error
      end

      NARRATIVE_CLAIM_TIMEOUT = 2.minutes # 2x the fit/gap Gemini timeout plus margin

      def request_narrative(force:)
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        with_fitgap_inputs(vacancy_id) do |portfolio, vacancy|
          presenter = FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy)
          if !force && presenter.narrative[:status] == 'complete'
            next json_response(report: presenter.as_json)
          end

          enqueue_narrative(portfolio, vacancy)
          render json: { report: FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).as_json },
                 status: :accepted
        end
      end

      # Atomic claim: only the request that moves the report to "generating"
      # enqueues a job, so repeated or concurrent requests create one job (AC-46).
      def enqueue_narrative(portfolio, vacancy)
        report = FitGapReport.create_or_find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        now = Time.current
        claimed = FitGapReport.where(id: report.id)
                              .where("status <> 'generating' OR requested_at IS NULL OR requested_at < ?",
                                     now - NARRATIVE_CLAIM_TIMEOUT)
                              .update_all(status: 'generating', requested_at: now, error_code: nil) == 1
        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) if claimed
      end

      def with_fitgap_inputs(vacancy_id)
        return json_error('vacancy_id is required', :unprocessable_entity) if vacancy_id.blank?

        portfolio = tenant_portfolios.find(params[:id])
        vacancy   = Vacancy.find_by(id: vacancy_id)
        return json_error('Vacancy not found', :not_found) unless vacancy

        unless portfolio.complete?
          return render json: { code: 'portfolio_not_ready', generation_status: portfolio.generation_status },
                        status: :conflict
        end
        if vacancy.vacancy_skills.empty?
          return render json: { code: 'vacancy_has_no_skills', message: 'Add required skills to this vacancy' },
                        status: :unprocessable_entity
        end

        yield portfolio, vacancy
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # Portfolio has no tenant column; scope through the owning session so that
      # another organisation's portfolio behaves as if it does not exist (404).
      def tenant_portfolios
        Portfolio.for_tenant(current_tenant_id)
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
          generation_error_code: portfolio.generation_error_code,
          generation_error_message: generation_error_message(portfolio.generation_error_code),
          ratings_validated: portfolio.ratings_validated,
          skills:            portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides:         portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        Portfolios::SkillPresenter.new(skill).as_json
      end

      GENERATION_ERROR_MESSAGES = {
        'timeout'              => 'The AI model took too long to respond. Please retry.',
        'rate_limited'         => 'The AI model is busy right now. Please retry in a few minutes.',
        'provider_unavailable' => 'The AI model is temporarily unavailable. Please retry.',
        'provider_denied'      => 'The AI provider rejected the request. Contact your administrator.',
        'invalid_output'       => 'The AI returned a result that could not be used. Please retry.',
        'empty_output'         => 'The AI returned an empty result. Please retry.',
        'unknown'              => 'Portfolio generation failed. Please retry.'
      }.freeze

      def generation_error_message(code)
        GENERATION_ERROR_MESSAGES[code] if code
      end

      def override_json(override)
        {
          id:             override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:       override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by:  override.overridden_by,
          overridden_at:  override.overridden_at,
          lock_version:   override.lock_version
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          schema_version: 2,
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio)
        }

        if vacancy_id.present?
          vacancy = Vacancy.find_by(id: vacancy_id)
          data[:fit_gap_report] = vacancy && FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).as_json
        end

        data
      end
    end
  end
end
