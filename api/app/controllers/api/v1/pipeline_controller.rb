# frozen_string_literal: true

module Api
  module V1
    class PipelineController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/pipeline
      # Returns all sessions for the tenant, with assessment name, for Kanban board
      def index
        sessions = Session
          .includes(:assessment)
          .where(tenant_id: current_tenant_id)
          .order(created_at: :desc)

        # Optional filter by vacancy (if assessment is linked to vacancy in future)
        # For now just return all

        render json: {
          sessions: sessions.map { |s| pipeline_session_json(s) }
        }
      end

      private

      def pipeline_session_json(session)
        {
          id:               session.id,
          assessment_id:    session.assessment_id,
          assessment_name:  session.assessment&.name,
          candidate_name:   session.candidate_name,
          status:           session.status,
          end_reason:       session.end_reason,
          pipeline_stage:   session.pipeline_stage,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          created_at:       session.created_at
        }
      end
    end
  end
end

