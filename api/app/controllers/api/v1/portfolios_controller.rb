# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export fitgap show_fitgap regenerate_fitgap]

      def show
        if @portfolio.nil? || @portfolio.generating? || @portfolio.pending?
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

      def regenerate
        portfolio = @session.portfolio
        portfolio&.portfolio_skills&.destroy_all
        portfolio&.update!(generation_status: 'pending')

        PortfolioGeneratorWorker.perform_async(@session.id)
        render json: { status: "queued" }, status: :accepted
      end

      def export
        format = params.fetch(:format, "json")

        unless %w[pdf json].include?(format)
          return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity)
        end

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        if format == "pdf"
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio).call
          send_data pdf_data, filename: "portfolio-#{@portfolio.id}.pdf", type: "application/pdf"
        else
          json_response(portfolio: portfolio_json(@portfolio))
        end
      end

      def fitgap
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless @portfolio.complete?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: vacancy.id)

        if report.present?
          json_response(report: fit_gap_json(report))
        else
          FitGapGeneratorWorker.perform_async(@portfolio.id, vacancy.id)
          render json: { status: "generating" }, status: :accepted
        end
      end

      def show_fitgap
        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: params[:vacancy_id])

        if report.nil?
          return json_error("Fit/gap report not found", :not_found)
        end

        json_response(report: fit_gap_json(report))
      end

      def regenerate_fitgap
        vacancy_id = params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = Vacancy.find_by(id: vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy

        unless @portfolio.complete?
          return json_error("Portfolio is not ready (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        #preservasi report row yang ada hingga background worker finishes replacement
        FitGapGeneratorWorker.perform_async(@portfolio.id, vacancy.id)
        render json: { status: "queued" }, status: :accepted
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_portfolio
        #cari portfolio melalui current tenant untuk mencegah enumerasi cross-tenant
        if @session
          @portfolio = @session.portfolio
        else
          @portfolio = Portfolio.for_tenant(current_tenant_id).find(params[:id])
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      def portfolio_json(portfolio)
        #return attribut portofolio with child skills and overrides the array
        overrides = portfolio.portfolio_skills.map(&:assessor_override).compact
        {
          id:                portfolio.id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          skills:            portfolio.portfolio_skills.map { |s| skill_json(s) },
          overrides:         overrides.map { |o| override_json(o) }
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

      def skill_json(skill)
        override = skill.assessor_override
        {
          id:                 skill.id,
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          is_discovered:      skill.is_discovered,
          ai_level:           skill.ai_level,
          effective_level:    override&.override_level || skill.ai_level,
          confidence:         override ? 'high' : skill.ai_confidence,
          is_override:        override.present?,
          override_notes:     override&.assessor_notes,
          evidence:           skill.evidence_quotes,
          competency_summary: skill.competency_summary
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
    end
  end
end
