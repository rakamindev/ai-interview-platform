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

        # Regeneration no longer destroys the published result, so it is allowed at any time except
        # while an earlier request is still queued or running.
        generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: "assessor_regenerate").call

        json_response(
          message:    "Portfolio generation queued",
          generation: generation_json(generation),
          portfolio:  portfolio_json(portfolio.reload)
        )
      rescue Portfolios::RequestGeneration::NotAllowed => e
        render json: { errors: [{ status: 422, code: e.code, message: e.message }] }, status: :unprocessable_entity
      rescue Portfolios::RequestGeneration::EnqueueFailed => e
        render json: {
          errors: [{ status: 503, message: "Scoring could not be started. The current result is unchanged; please try again." }],
          generation: generation_json(e.generation)
        }, status: :service_unavailable
      rescue Portfolios::RequestGeneration::InFlight => e
        render json: {
          errors: [{ status: 409, message: "A scoring run is already in progress." }],
          generation: generation_json(e.generation)
        }, status: :conflict
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
        portfolio  = Portfolio.visible_to_current_tenant.find(params[:id])
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
        portfolio = Portfolio.visible_to_current_tenant.find(params[:id])

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

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = Portfolio.visible_to_current_tenant.find(params[:id])
        # The vacancy is the second id crossing the tenant boundary: it must be the current tenant's too.
        vacancy   = Vacancy.find_by(id: params[:vacancy_id])
        report    = vacancy && FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)

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
          @portfolio = Portfolio.visible_to_current_tenant.find(params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def portfolio_json(portfolio)
        current_keys = portfolio.portfolio_skills.pluck(:skill_key).to_set
        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  portfolio.generation_error,
          current_generation: portfolio.current_generation && generation_json(portfolio.current_generation),
          latest_generation:  portfolio.latest_generation && generation_json(portfolio.latest_generation),
          regenerate:         regenerate_json(portfolio),
          skills:            portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides:         portfolio.assessor_overrides.includes(:portfolio_skill)
                                      .map { |o| override_json(o, portfolio, current_keys) }
        }
      end

      # Assessor-facing view of one scoring run. Error text is the provider message, which never
      # contains transcript content.
      def generation_json(generation)
        {
          id:              generation.id,
          sequence:        generation.sequence,
          status:          generation.status,
          source:          generation.source,
          requested_model: generation.requested_model,
          served_model:    generation.served_model,
          prompt_version:  generation.prompt_version,
          error_code:      generation.error_code,
          error_message:   generation.error_message,
          queued_at:       generation.queued_at,
          finished_at:     generation.finished_at
        }
      end

      # Tells the UI whether to offer Regenerate and, if not, why (so it can say so honestly).
      def regenerate_json(portfolio)
        blocker = Portfolios::RequestGeneration.regenerate_blocker(portfolio)
        return { allowed: true } unless blocker

        code = blocker.is_a?(Portfolios::RequestGeneration::InFlight) ? 'in_progress' : blocker.code
        { allowed: false, reason: code, message: blocker.message }
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

      # `orphaned`: the skill this decision is about is not in the current report any more. A decision
      # can sit on an older report's row and still not be orphaned (e.g. superseded by a newer
      # decision for the same skill), so this is decided by skill_key, not by the row's generation.
      def override_json(override, portfolio = nil, current_keys = nil)
        {
          id:             override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:       override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by:  override.overridden_by,
          overridden_at:  override.overridden_at,
          needs_review:   override.needs_review,
          review_reason:  override.review_reason,
          first_made_on_generation_id: override.first_made_on_generation_id,
          last_decided_on_generation_id:    override.last_decided_on_generation_id,
          skill_label:    override.portfolio_skill.skill_label,
          orphaned:       current_keys ? !current_keys.include?(override.portfolio_skill.skill_key) : false
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
          vacancy = Vacancy.find_by(id: vacancy_id) # tenant-scoped: another tenant's vacancy is ignored
          report  = vacancy && FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end

        data
      end
    end
  end
end
