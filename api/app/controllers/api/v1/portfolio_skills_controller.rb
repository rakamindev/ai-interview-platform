# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio_skills/:id/override
      # Saving again updates the decision (200). Review state reflects the AI basis actually seen;
      # a stale-screen save can retain a review flag.
      def override
        result = Portfolios::SaveOverride.new(
          portfolio_skill: @portfolio_skill,
          override_level:  override_params[:override_level],
          assessor_notes:  override_params[:assessor_notes],
          user_id:         current_user.id
        ).call
        @portfolio_skill = result.override.portfolio_skill
        regenerate_stale_fitgap_reports
        json_response({ override: override_json(result.override) }, result.created ? :created : :ok)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      private

      def regenerate_stale_fitgap_reports
        portfolio = @portfolio_skill.portfolio
        FitGapReport.where(portfolio_id: portfolio.id).each do |report|
          vacancy_id = report.vacancy_id
          report.destroy
          FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id)
        end
      end

      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill.visible_to_current_tenant.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
      end

      def override_json(override)
        {
          id:                 override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:           override.ai_level,
          override_level:     override.override_level,
          assessor_notes:     override.assessor_notes,
          overridden_by:      override.overridden_by,
          overridden_at:      override.overridden_at,
          needs_review:       override.needs_review,
          review_reason:      override.review_reason
        }
      end
    end
  end
end
