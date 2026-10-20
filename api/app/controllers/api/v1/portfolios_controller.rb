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

        # AC-G5: Return 409 conflict if already generating
        if portfolio.generating?
          return render json: { error: "Portfolio generation already in progress" }, status: :conflict
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
        format = params.fetch(:format, "json").to_s.downcase

        # AC-S2: validate export format
        unless %w[pdf json].include?(format)
          return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity)
        end

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        vacancy = nil
        if params[:vacancy_id].present?
          unless params[:vacancy_id].to_s.match?(/\A\d+\z/)
            return json_error("vacancy_id must be an integer", :unprocessable_entity)
          end

          vacancy = Vacancy.find_by(id: params[:vacancy_id])
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
        vacancy_id = vacancy&.id || params[:vacancy_id]
        export_data = build_export_json(@portfolio, vacancy_id)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}.json",
                  type:        "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = current_tenant_portfolios.find(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?
        unless vacancy_id.to_s.match?(/\A\d+\z/)
          return json_error("vacancy_id must be an integer", :unprocessable_entity)
        end

        # AC-S1 & AC-S2: Scoped to tenant
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
        portfolio = current_tenant_portfolios.find(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?
        unless vacancy_id.to_s.match?(/\A\d+\z/)
          return json_error("vacancy_id must be an integer", :unprocessable_entity)
        end

        # AC-S1 & AC-S2: Scoped to tenant
        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Return cached report if it exists
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
        portfolio = current_tenant_portfolios.find(params[:id])
        unless params[:vacancy_id].to_s.match?(/\A\d+\z/)
          return json_error("vacancy_id must be an integer", :unprocessable_entity)
        end

        vacancy = Vacancy.find_by(id: params[:vacancy_id])
        return json_error("Vacancy not found", :not_found) unless vacancy

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        json_response(report: fit_gap_json(report))
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      private

      def current_tenant_portfolios
        Portfolio.joins(:session).where(sessions: { tenant_id: Current.tenant_id })
      end

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        # Routes use :id for both session-based and direct portfolio lookups
        if @session
          @portfolio = @session.portfolio
          return json_error("Portfolio not found", :not_found) unless @portfolio
        else
          @portfolio = current_tenant_portfolios.find(params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def portfolio_json(portfolio)
        session = portfolio.session
        assessment = session&.assessment

        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  portfolio.generation_error,
          duration_seconds:  session&.duration_seconds,
          time_limit_min:    assessment&.time_limit_min,
          end_reason:        session&.end_reason,
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
          assessment_status:  skill.assessment_status,
          status_reason:      skill.status_reason,
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
          narrative_status:  report.respond_to?(:narrative_status) && report.narrative_status.present? ? report.narrative_status : 'generated',
          stale:             report.respond_to?(:stale?) ? report.stale? : false,
          generated_at:      report.generated_at
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        fit_gap = vacancy_id ? FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy_id) : nil

        {
          portfolio: portfolio_json(portfolio),
          fit_gap:   fit_gap ? fit_gap_json(fit_gap) : nil
        }
      end
    end
  end
end
