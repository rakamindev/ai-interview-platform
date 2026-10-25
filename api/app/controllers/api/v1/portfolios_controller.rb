# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :admin

      before_action :set_session,   only: %i[show history regenerate]
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

      # GET /api/v1/sessions/:id/portfolio/history
      def history
        portfolio = @session.portfolio
        return json_error("No portfolio found for this session", :not_found) unless portfolio

        json_response(revisions: portfolio.revisions.newest_first.map(&method(:portfolio_revision_json)))
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio

        if portfolio.nil?
          return json_error("No portfolio found for this session", :not_found)
        end

        if portfolio.generating? || portfolio.generation_status == 'pending'
          return json_error("Portfolio is already being generated", :unprocessable_entity)
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

        revision = selected_revision
        return json_error("Portfolio revision not found", :not_found) if params[:revision_id].present? && revision.nil?

        vacancy = params[:vacancy_id].present? ? Vacancy.find_by(id: params[:vacancy_id]) : nil
        fit_gap_report = selected_fit_gap_report(vacancy, revision)

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(
            portfolio:      @portfolio,
            vacancy:        vacancy,
            snapshot:       revision&.snapshot,
            fit_gap_report: fit_gap_report,
            generated_at:   revision&.generated_at,
            portfolio_version: revision&.version,
          ).call

          return send_data pdf_data,
                           filename:    "portfolio-#{@portfolio.id}#{revision ? "-v#{revision.version}" : ""}.pdf",
                           type:        "application/pdf",
                           disposition: "attachment"
        end

        # JSON export
        export_data = build_export_json(@portfolio, params[:vacancy_id], revision, fit_gap_report)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}#{revision ? "-v#{revision.version}" : ""}.json",
                  type:        "application/json",
                  disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = Portfolio.find(params[:id])
        vacancy_id = params[:vacancy_id]
        revision   = portfolio_revision_for(portfolio)
        return json_error("Portfolio revision not found", :not_found) if requested_portfolio_revision_id.present? && revision.nil?

        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id, revision&.id)

        render json: { status: "generating", message: "Fit/gap report regeneration queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = Portfolio.find(params[:id])
        revision  = portfolio_revision_for(portfolio)
        return json_error("Portfolio revision not found", :not_found) if requested_portfolio_revision_id.present? && revision.nil?

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        # Return cached report if it exists and portfolio has no new overrides
        existing = fit_gap_reports_for(portfolio, vacancy, revision).first
        if existing
          return json_response(report: fit_gap_json(existing))
        end

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id, revision&.id)
        render json: { status: "generating", message: "Fit/gap report generation queued" }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = Portfolio.find(params[:id])
        revision  = portfolio_revision_for(portfolio)
        return json_error("Portfolio revision not found", :not_found) if requested_portfolio_revision_id.present? && revision.nil?
        report    = fit_gap_reports_for(portfolio, Vacancy.find(params[:vacancy_id]), revision).first

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

      def portfolio_revision_for(portfolio)
        revision_id = requested_portfolio_revision_id
        return unless revision_id.present?

        portfolio.revisions.find_by(id: revision_id)
      end

      def requested_portfolio_revision_id
        params[:portfolio_revision_id] || params.dig(:fitgap, :portfolio_revision_id)
      end

      def fit_gap_reports_for(portfolio, vacancy, revision)
        FitGapReport.where(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id,
          portfolio_revision_id: revision&.id
        )
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
          overrides:         active_overrides_for(portfolio).map(&method(:override_json))
        }
      end

      def portfolio_revision_json(revision)
        {
          id:                revision.id,
          portfolio_id:      revision.portfolio_id,
          version:           revision.version,
          generation_status: revision.generation_status,
          generated_at:      revision.generated_at,
          generation_error:  revision.generation_error,
          snapshot:          revision.snapshot,
          created_at:        revision.created_at
        }
      end

      def selected_revision
        return unless params[:revision_id].present?

        @portfolio.revisions.find_by(id: params[:revision_id])
      end

      def selected_fit_gap_report(vacancy, revision)
        return unless vacancy

        fit_gap_reports_for(@portfolio, vacancy, revision).first
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

      def active_overrides_for(portfolio)
        skills_by_id = portfolio.portfolio_skills.index_by(&:id)
        portfolio.assessor_overrides.select do |override|
          skill = skills_by_id[override.portfolio_skill_id]
          skill && override.override_level != skill.ai_level
        end
      end

      def fit_gap_json(report)
        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          portfolio_revision_id: report.portfolio_revision_id,
          portfolio_version: report.portfolio_revision&.version,
          skill_comparisons: fit_gap_comparisons_json(report),
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at
        }
      end

      def fit_gap_comparisons_json(report)
        override_labels = if report.portfolio_revision
                            snapshot = report.portfolio_revision.snapshot
                            skills = Array(snapshot['skills'] || snapshot[:skills])
                            skill_labels_by_id = skills.index_by { |skill| skill['id'] || skill[:id] }
                            overrides_by_id = Array(snapshot['overrides'] || snapshot[:overrides]).index_by do |override|
                              override['portfolio_skill_id'] || override[:portfolio_skill_id]
                            end
                            overrides_by_id.filter_map do |skill_id, override|
                              skill = skill_labels_by_id[skill_id]
                              next unless skill && (override['override_level'] || override[:override_level]).to_i != (skill['ai_level'] || skill[:ai_level]).to_i
                              skill['skill_label'] || skill[:skill_label]
                            end
                          else
                            active_overrides_for(report.portfolio).filter_map do |override|
                              report.portfolio.portfolio_skills.find { |skill| skill.id == override.portfolio_skill_id }&.skill_label
                            end
                          end

        Array(report.skill_comparisons).map do |comparison|
          comparison.merge(
            'is_override' => override_labels.include?(comparison['skill_label'])
          )
        end
      end

      def build_export_json(portfolio, vacancy_id = nil, revision = nil, fit_gap_report = nil)
        portfolio_data = if revision
                           snapshot = revision.snapshot
                           {
                             id:                portfolio.id,
                             session_id:        portfolio.session_id,
                             candidate_id:      portfolio.candidate_id,
                             generation_status: revision.generation_status,
                             generated_at:      revision.generated_at,
                             generation_error:  revision.generation_error,
                             skills:            snapshot['skills'] || snapshot[:skills] || [],
                             overrides:         snapshot['overrides'] || snapshot[:overrides] || []
                           }
                         else
                           portfolio_json(portfolio)
                         end

        data = {
          exported_at: Time.current.iso8601,
          portfolio_version: revision ? revision.version : 'current',
          portfolio:   portfolio_data
        }

        if vacancy_id.present?
          data[:fit_gap_report] = fit_gap_report ? fit_gap_json(fit_gap_report) : nil
        end

        data
      end
    end
  end
end
