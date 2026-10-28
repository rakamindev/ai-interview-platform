# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      rescue_from PortfolioSkills::OverrideActions::Error do |error|
        status = Rack::Utils.status_code(error.status)
        render json: { errors: [{ status: status, message: error.message, code: error.code }.compact] },
               status: error.status
      end

      # POST /api/v1/portfolio_skills/:id/override
      def override
        override, created = actions.set(level: override_param(:level, :override_level),
                                        notes: override_param(:notes, :assessor_notes),
                                        lock_version: override_param(:lock_version))
        json_response({ override: override_json(override) }, created ? :created : :ok)
      end

      # DELETE /api/v1/portfolio_skills/:id/override
      def revert
        actions.revert(notes: params[:notes])
        json_response(override: nil)
      end

      # POST /api/v1/portfolio_skills/:id/confirm
      def confirm
        event = actions.confirm(notes: params[:notes])
        json_response({ event: event_json(event) }, :created)
      end

      # GET /api/v1/portfolio_skills/:id/override_events
      def override_events
        json_response(events: @portfolio_skill.override_events.reverse.map(&method(:event_json)))
      end

      private

      def set_portfolio_skill
        @portfolio_skill = PortfolioSkill.for_tenant(current_tenant_id).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def actions
        PortfolioSkills::OverrideActions.new(@portfolio_skill, actor_id: current_user.id)
      end

      # Accepts the documented names and the original ones (override_level, assessor_notes).
      def override_param(*keys)
        attributes = params[:override].presence || {}
        keys.lazy.map { |key| attributes[key] }.find { |value| !value.nil? }
      end

      def event_json(event)
        event.slice(:id, :action, :from_level, :to_level, :ai_level_at_time, :notes, :actor_id, :created_at)
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
          lock_version:       override.lock_version
        }
      end
    end
  end
end
