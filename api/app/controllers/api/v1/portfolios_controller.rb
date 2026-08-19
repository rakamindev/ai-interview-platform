# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        # Self-healing: if portfolio is stuck in pending/generating with no skills,
        # trigger inline generation (Sidekiq probably never ran)
        if @portfolio && stuck_pending?(@portfolio)
          trigger_inline_generation(@session)
          return render json: { status: "generating" }, status: :accepted
        end

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
        if sidekiq_available?
          PortfolioGeneratorWorker.perform_async(@session.id)
        else
          trigger_inline_generation(@session)
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
        portfolio  = Portfolio.find(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

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

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Return cached report if it exists and portfolio has no new overrides
        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if existing
          return json_response(report: fit_gap_json(existing))
        end

        if sidekiq_available?
          FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        else
          trigger_inline_fitgap_generation(portfolio, vacancy)
        end
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

      # Returns true if a portfolio has been stuck in pending/generating for >30s
      # with no skills generated (Sidekiq probably never processed the job)
      def stuck_pending?(portfolio)
        return false unless %w[pending generating].include?(portfolio.generation_status)
        return false if portfolio.portfolio_skills.any?

        # Consider stuck if session ended more than 30 seconds ago
        portfolio.session.ended_at && portfolio.session.ended_at < 30.seconds.ago
      end

      def sidekiq_available?
        Sidekiq::ProcessSet.new.size > 0
      rescue
        false
      end

      def trigger_inline_generation(session)
        session_id = session.id
        Thread.new do
          begin
            s = Session.find(session_id)
            Portfolios::Generator.new(session: s).call
            Rails.logger.info("[PortfoliosController] Inline portfolio generation completed for session #{session_id}")
          rescue => e
            Rails.logger.error("[PortfoliosController] Inline portfolio generation failed: #{e.message}")
          end
        end
      end

      def trigger_inline_fitgap_generation(portfolio, vacancy)
        portfolio_id = portfolio.id
        vacancy_id = vacancy.id
        Thread.new do
          begin
            p = Portfolio.find(portfolio_id)
            v = Vacancy.find(vacancy_id)
            FitGap::Engine.new(portfolio: p, vacancy: v).call
            Rails.logger.info("[PortfoliosController] Inline fit/gap generation completed for portfolio #{portfolio_id}")
          rescue => e
            Rails.logger.error("[PortfoliosController] Inline fit/gap generation failed: #{e.message}")
          end
        end
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
