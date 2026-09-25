# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      def override
        @portfolio_skill.portfolio.with_lock do
          existing = @portfolio_skill.reload.assessor_override
          record = existing || @portfolio_skill.build_assessor_override(ai_level: @portfolio_skill.ai_level)
          record.assign_attributes(override_params.merge(overridden_by: current_user.id, overridden_at: Time.current))
          if record.save
            json_response({ override: override_json(record) }, existing ? :ok : :created)
          else
            json_error(record.errors.full_messages.first, :unprocessable_entity)
          end
        end
      end

      private

      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                         .where(sessions: { tenant_id: current_tenant_id })
                                         .find(params[:id])
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
          overridden_at:      override.overridden_at
        }
      end
    end
  end
end
