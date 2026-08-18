module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      def override
        portfolio = @portfolio_skill.portfolio
        saved_override = nil
        error_message = nil
        vacancy_ids = []

        portfolio.with_lock do
          existing = @portfolio_skill.assessor_override
          attributes = override_params.merge(overridden_by: current_user.id, overridden_at: Time.current)
          saved_override = existing || @portfolio_skill.build_assessor_override(
            attributes.merge(ai_level: @portfolio_skill.ai_level)
          )

          unless saved_override.update(attributes)
            error_message = saved_override.errors.full_messages.first
            next
          end

          vacancy_ids = portfolio.fit_gap_reports.lock.pluck(:vacancy_id)
          portfolio.fit_gap_reports.update_all(
            generation_status: "pending",
            generation_error: nil,
            generation_started_at: Time.current,
            generation_token: nil,
            updated_at: Time.current
          )
        end

        return json_error(error_message, :unprocessable_entity) if error_message

        vacancy_ids.each { |vacancy_id| FitGapGeneratorWorker.perform_async(portfolio.id, vacancy_id) }
        status = saved_override.previously_new_record? ? :created : :ok
        json_response({ override: override_json(saved_override) }, status)
      end

      private

      def set_portfolio_skill
        @portfolio_skill = TenantResourceAccess.new(current_tenant_id).portfolio_skill(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
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
    end
  end
end
