# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      def override
        existing = @portfolio_skill.assessor_override

        if existing
          if existing.update(override_params.merge(overridden_by: current_user.id, overridden_at: Time.current))
            regenerate_stale_fitgap_reports
            json_response(override: override_json(existing))
          else
            json_error(existing.errors.full_messages.first, :unprocessable_entity)
          end
        else
          new_override = @portfolio_skill.build_assessor_override(
            override_params.merge(
              ai_level:      @portfolio_skill.ai_level,
              overridden_by: current_user.id,
              overridden_at: Time.current
            )
          )

          if new_override.save
            regenerate_stale_fitgap_reports
            json_response({ override: override_json(new_override) }, :created)
          else
            json_error(new_override.errors.full_messages.first, :unprocessable_entity)
          end
        end
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
