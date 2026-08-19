# frozen_string_literal: true

module Api
  module V1
    class OverrideEventsController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/portfolio-skills/:portfolio_skill_id/override_events
      def index
        events = AssessorOverrideEvent
          .joins(:portfolio_skill)
          .where(portfolio_skill_id: params[:portfolio_skill_id])
          .order(overridden_at: :asc)

        json_response(events.map { |e| event_json(e) })
      end

      private

      def event_json(event)
        {
          id: event.id,
          portfolio_skill_id: event.portfolio_skill_id,
          ai_level: event.ai_level,
          override_level: event.override_level,
          assessor_notes: event.assessor_notes,
          overridden_by: event.overridden_by,
          overridden_at: event.overridden_at
        }
      end
    end
  end
end
