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
          vacancy = params[:vacancy_id].present? ? Vacancy.find(params[:vacancy_id]) : nil
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
        portfolio  = find_current_tenant_portfolio!(params[:id])
        vacancy_id = params[:vacancy_id]

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)

        if report&.pending? || report&.generating?
          return render json: {
            status: report.generation_status,
            message: "Fit/gap report generation is already in progress"
          }, status: :accepted
        end

        report ||= FitGapReport.new(
          portfolio: portfolio,
          vacancy: vacancy,
          skill_comparisons: []
        )
        report.update!(
          generation_status: 'pending',
          generation_error: nil,
          skill_comparisons: [],
          culture_narrative: nil,
          overall_narrative: nil,
          generated_at: nil
        )
        enqueue_fit_gap!(report, portfolio, vacancy)

        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = find_current_tenant_portfolio!(params[:id])

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if existing&.complete?
          if queue_if_stale!(existing, portfolio)
            return render json: {
              status: 'generating',
              report: fit_gap_json(existing),
              message: 'Fit/gap report is refreshing after a human override'
            }, status: :accepted
          end

          return json_response(report: fit_gap_json(existing))
        end

        if existing&.failed?
          return json_response(report: fit_gap_json(existing))
        end

        if existing
          return render json: {
            status: existing.generation_status,
            report: fit_gap_json(existing)
          }, status: :accepted
        end

        created = false
        report = begin
          record = FitGapReport.create!(
            portfolio: portfolio,
            vacancy: vacancy,
            skill_comparisons: [],
            generation_status: 'pending',
            generated_at: nil
          )
          created = true
          record
        rescue ActiveRecord::RecordNotUnique
          FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        end

        enqueue_fit_gap!(report, portfolio, vacancy) if created
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = find_current_tenant_portfolio!(params[:id])
        report    = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: params[:vacancy_id])

        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        if report.complete? && queue_if_stale!(report, portfolio)
          return render json: { report: fit_gap_json(report) }, status: :accepted
        end

        status = report.complete? || report.failed? ? :ok : :accepted
        render json: { report: fit_gap_json(report) }, status: status
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
          @portfolio = find_current_tenant_portfolio!(params[:id])
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

      def fit_gap_json(report)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: report.skill_comparisons,
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at,
          generation_status: report.generation_status,
          generation_error:  report.generation_error,
          review_summary:     review_summary(report.skill_comparisons)
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

      def find_current_tenant_portfolio!(id)
        Portfolio.for_tenant(current_tenant_id).find(id)
      end

      def enqueue_fit_gap!(report, portfolio, vacancy)
        FitGapGeneratorWorker.perform_async(
          portfolio.id,
          vacancy.id,
          current_tenant_id,
          report.id
        )
      rescue StandardError
        report.update(
          generation_status: 'failed',
          generation_error: 'The report could not be queued. Please try again.'
        )
        raise
      end

      def queue_if_stale!(report, portfolio)
        queued = false
        report.with_lock do
          next unless report.complete? && report_stale?(report, portfolio)

          report.update!(
            generation_status: 'pending',
            generation_error: nil,
            generated_at: nil
          )
          queued = true
        end
        enqueue_fit_gap!(report, portfolio, report.vacancy) if queued
        queued
      end

      def report_stale?(report, portfolio)
        return true if report.generated_at.nil?

        portfolio.assessor_overrides
                 .where('overridden_at > ?', report.generated_at)
                 .exists?
      end

      def review_summary(comparisons)
        rows = Array(comparisons).map(&:with_indifferent_access)
        counts = FitGapReport::FIT_RESULTS.index_with do |result|
          rows.count { |row| row[:result] == result }
        end
        low_confidence = rows.count { |row| row[:confidence] == 'low' }
        human_overrides = rows.count { |row| row[:is_override] == true }

        {
          total_skills: rows.count,
          match: counts['match'],
          gap: counts['gap'],
          exceed: counts['exceed'],
          not_assessed: counts['not_assessed'],
          low_confidence: low_confidence,
          human_overrides: human_overrides,
          decision_status: (counts['not_assessed'].positive? || low_confidence.positive?) ? 'review_required' : 'evidence_ready'
        }
      end
    end
  end
end
