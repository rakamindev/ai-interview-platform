module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session, only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      def show
        return render json: { status: "generating" }, status: :accepted if @portfolio.nil? || @portfolio.generation_status.in?(%w[pending generating])

        if @portfolio.failed?
          return json_response(
            portfolio: portfolio_json(@portfolio),
            error: @portfolio.generation_error
          )
        end

        json_response(portfolio: portfolio_json(@portfolio))
      end

      def regenerate
        portfolio = @session.portfolio
        return json_error("No portfolio found for this session", :not_found) unless portfolio
        return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity) unless portfolio.failed?

        portfolio.update!(generation_status: "pending", generation_error: nil, generation_started_at: nil, generation_token: nil)
        PortfolioGeneratorWorker.perform_async(@session.id)

        json_response(
          {
            message: "Portfolio generation queued",
            portfolio: portfolio_json(portfolio)
          }
        )
      end

      def export
        return json_error("Portfolio not found", :not_found) unless @portfolio

        format = params.fetch(:format, "json")
        return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity) unless %w[pdf json].include?(format)
        return json_error("Portfolio is not ready for export", :unprocessable_entity) unless @portfolio.complete?

        vacancy = scoped_vacancy(params[:vacancy_id]) if params[:vacancy_id].present?

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy:).call
          return send_data pdf_data,
                           filename: "portfolio-#{@portfolio.id}.pdf",
                           type: "application/pdf",
                           disposition: "attachment"
        end

        send_data build_export_json(@portfolio, vacancy).to_json,
                  filename: "portfolio-#{@portfolio.id}.json",
                  type: "application/json",
                  disposition: "attachment"
      rescue ActiveRecord::RecordNotFound
        json_error("Vacancy not found", :not_found)
      end

      def regenerate_fitgap
        return json_error("vacancy_id is required", :unprocessable_entity) if params[:vacancy_id].blank?

        portfolio = scoped_portfolio(params[:id])
        vacancy = scoped_vacancy(params[:vacancy_id])
        return json_error("Portfolio is not ready", :unprocessable_entity) unless portfolio.complete?

        report = find_or_build_report(portfolio, vacancy)
        queue_fitgap(report, portfolio, vacancy, force: true)
        render_fitgap_status(report)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio or vacancy not found", :not_found)
      end

      def fitgap
        portfolio = scoped_portfolio(params[:id])
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = scoped_vacancy(vacancy_id)
        return json_error("Portfolio is not ready", :unprocessable_entity) unless portfolio.complete?

        report = find_or_build_report(portfolio, vacancy)
        return json_response(report: fit_gap_json(report)) if report.complete?

        queue_fitgap(report, portfolio, vacancy)
        render_fitgap_status(report)
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio or vacancy not found", :not_found)
      end

      def show_fitgap
        portfolio = scoped_portfolio(params[:id])
        vacancy = scoped_vacancy(params[:vacancy_id])
        report = portfolio.fit_gap_reports.find_by(vacancy_id: vacancy.id)
        return json_error("Fit/gap report not found", :not_found) unless report

        json_response(report: fit_gap_json(report))
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio or vacancy not found", :not_found)
      end

      private

      def access
        @access ||= TenantResourceAccess.new(current_tenant_id)
      end

      def scoped_portfolio(id)
        access.portfolio(id)
      end

      def scoped_vacancy(id)
        access.vacancy(id)
      end

      def set_session
        @session = access.session(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        @portfolio = @session ? @session.portfolio : scoped_portfolio(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def find_or_build_report(portfolio, vacancy)
        report = portfolio.fit_gap_reports.find_or_initialize_by(vacancy_id: vacancy.id)
        return report unless report.new_record?

        report.skill_comparisons = []
        report.generation_status = "pending"
        report.save!
        report
      rescue ActiveRecord::RecordNotUnique
        portfolio.fit_gap_reports.find_by!(vacancy_id: vacancy.id)
      end

      def render_fitgap_status(report)
        render json: {
          status: report.generation_status,
          report: fit_gap_json(report)
        }, status: :accepted
      end

      def queue_fitgap(report, portfolio, vacancy, force: false)
        should_enqueue = false

        report.with_lock do
          fresh = report.generation_started_at && report.generation_started_at > Time.current - FitGapGeneratorWorker::GENERATION_LOCK_TIMEOUT
          next if report.generating? && fresh
          next if !force && report.complete?
          next if report.pending? && fresh

          report.update!(
            generation_status: "pending",
            generation_error: nil,
            generation_started_at: Time.current,
            generation_token: nil
          )
          should_enqueue = true
        end

        FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id) if should_enqueue
      end

      def portfolio_json(portfolio)
        {
          id: portfolio.id,
          session_id: portfolio.session_id,
          candidate_id: portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at: portfolio.generated_at,
          generation_error: portfolio.generation_error,
          skills: portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides: portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          is_discovered: skill.is_discovered,
          ai_level: skill.ai_level,
          rating_status: skill.rating_status,
          ai_confidence: skill.ai_confidence,
          evidence: skill.evidence_quotes,
          competency_summary: skill.competency_summary
        }
      end

      def override_json(override)
        {
          id: override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level: override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by: override.overridden_by,
          overridden_at: override.overridden_at
        }
      end

      def fit_gap_json(report)
        {
          id: report.id,
          portfolio_id: report.portfolio_id,
          vacancy_id: report.vacancy_id,
          generation_status: report.generation_status,
          generation_error: report.generation_error,
          skill_comparisons: report.skill_comparisons || [],
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at: report.generated_at
        }
      end

      def build_export_json(portfolio, vacancy)
        data = {
          exported_at: Time.current.iso8601,
          portfolio: portfolio_json(portfolio)
        }

        if vacancy
          report = portfolio.fit_gap_reports.find_by(vacancy_id: vacancy.id)
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end

        data
      end
    end
  end
end
