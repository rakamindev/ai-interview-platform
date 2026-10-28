# frozen_string_literal: true

module Api
  module V1
    class AssessmentSummariesController < ApiController
      authorize_auth_token! :assessor

      def show
        assessment = Assessment.find(params[:id] || params[:assessment_id])
        sessions = assessment.sessions.order(created_at: :desc)

        sessions_data = sessions.map do |s|
          portfolio = s.portfolio
          {
            id:               s.id,
            candidate_name:   s.candidate_name,
            status:           s.status,
            end_reason:       s.end_reason,
            started_at:       s.started_at,
            ended_at:         s.ended_at,
            duration_seconds: s.duration_seconds,
            created_at:       s.created_at,
            portfolio_status: portfolio&.generation_status,
            portfolio_id:     portfolio&.id,
          }
        end

        total     = sessions.count
        pending   = sessions.count { |s| s.status == 'pending' }
        active    = sessions.count { |s| s.status == 'active' }
        ended     = sessions.count { |s| s.status == 'ended' }
        completed = sessions.count { |s| s.status == 'ended' && s.end_reason != 'error' }
        failed    = sessions.count { |s| s.status == 'ended' && s.end_reason == 'error' }

        durations = sessions.select { |s| s.status == 'ended' && s.duration_seconds.to_i > 0 }.map(&:duration_seconds)
        avg_duration = durations.any? ? (durations.sum.to_f / durations.size / 60).round(1) : nil

        json_response(
          assessment: {
            id:             assessment.id,
            name:           assessment.name,
            time_limit_min: assessment.time_limit_min,
            language:       assessment.language,
          },
          sessions: sessions_data,
          stats: {
            total:            total,
            pending:          pending,
            active:           active,
            ended:            ended,
            completed:        completed,
            failed:           failed,
            avg_duration_min: avg_duration,
          }
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end
    end
  end
end

