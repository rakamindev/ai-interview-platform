# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      include TenantOwnedRecords

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
      # Forces a new run even if the report is up to date (e.g. to retry the
      # AI narrative). Never deletes the existing report.
      def regenerate_fitgap
        request_fitgap(force: true)
      end

      # POST /api/v1/portfolios/:id/fitgap
      # Idempotent "ensure": returns the report, queuing a generation only when
      # none is in flight and the stored one is missing, failed or outdated.
      #   200 → complete and up to date
      #   202 → pending/generating (poll GET …/fitgap/:vacancy_id)
      def fitgap
        request_fitgap(force: false)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = tenant_portfolios.find(params[:id])
        vacancy   = find_vacancy(params[:vacancy_id])
        return if performed?

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        return json_error("Fit/gap report not found", :not_found) if report.nil?

        json_response(report: present_fitgap(report, portfolio, vacancy))
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

      def request_fitgap(force:)
        portfolio = tenant_portfolios.find(params[:id])
        vacancy   = find_vacancy(params.dig(:fitgap, :vacancy_id) || params[:vacancy_id])
        return if performed?

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGap::Scheduler.request(portfolio:, vacancy:, force:)
        json_response({ report: present_fitgap(report, portfolio, vacancy) },
                      report.complete? ? :ok : :accepted)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # Renders 422/404 and returns nil when the id is unusable; callers check
      # performed?. Vacancy is TenantScoped, so other tenants' ids are 404.
      def find_vacancy(vacancy_id)
        if vacancy_id.blank?
          json_error("vacancy_id is required", :unprocessable_entity)
        elsif !vacancy_id.to_s.match?(/\A\d+\z/)
          json_error("vacancy_id must be a positive integer", :unprocessable_entity)
        else
          Vacancy.find_by(id: vacancy_id) || json_error("Vacancy not found", :not_found)
        end
      end

      def present_fitgap(report, portfolio, vacancy)
        digest = FitGap::Inputs.new(portfolio:, vacancy:).digest
        FitGap::ReportPresenter.new(report, current_digest: digest).as_json
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio)
        }

        if vacancy_id.present?
          vacancy = Vacancy.find_by(id: vacancy_id)
          report  = vacancy && FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
          data[:fit_gap_report] = report ? present_fitgap(report, portfolio, vacancy) : nil
        end

        data
      end
    end
  end
end
