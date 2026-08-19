# frozen_string_literal: true

module Api
  module V1
    class CandidatesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_candidate, only: %i[show]

      # GET /api/v1/candidates
      # GET /api/v1/candidates?q=budi
      def index
        scope = Candidate.all
        scope = scope.where('name ILIKE :q OR email ILIKE :q', q: "%#{params[:q]}%") if params[:q].present?
        candidates = paginate(scope.order(created_at: :desc))

        json_response(
          candidates: candidates.map(&method(:candidate_json)),
          meta: pagination_meta(candidates)
        )
      end

      # GET /api/v1/candidates/:id
      def show
        sessions = @candidate.sessions.includes(:assessment).order(created_at: :desc)

        json_response(
          candidate: candidate_json(@candidate).merge(
            sessions: sessions.map(&method(:session_summary_json))
          )
        )
      end

      private

      def set_candidate
        @candidate = Candidate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Candidate not found", :not_found)
      end

      def candidate_json(candidate)
        {
          id:            candidate.id,
          name:          candidate.name,
          email:         candidate.email,
          phone:         candidate.phone,
          address:       candidate.address,
          cv_url:        cv_url_for(candidate),
          sessions_count: candidate.sessions.size,
          created_at:    candidate.created_at
        }
      end

      def cv_url_for(candidate)
        return nil unless candidate.cv.attached?

        uri = URI.parse(ENV.fetch('API_BASE_URL', 'http://localhost:3001'))
        Rails.application.routes.url_helpers.rails_blob_url(
          candidate.cv, host: uri.host, port: uri.port, protocol: uri.scheme
        )
      end

      def session_summary_json(session)
        {
          id:               session.id,
          assessment_id:    session.assessment_id,
          assessment_name:  session.assessment&.name,
          time_limit_min:   session.assessment&.time_limit_min,
          duration_seconds: session.duration_seconds,
          status:           session.status,
          end_reason:       session.end_reason,
          invite_url:       session.invite_url,
          expires_at:       session.expires_at,
          expired:          session.expired?,
          created_at:       session.created_at
        }
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end
    end
  end
end
