# frozen_string_literal: true

module Api
  module V1
    # Candidate-centric view: every session is one candidate appearance.
    # Lets assessors browse candidates across assessments instead of going
    # through the assessment → session flow every time.
    class CandidatesController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/candidates
      def index
        scope = Session.includes(:assessment, :portfolio)
        scope = scope.where('candidate_name ILIKE ?', "%#{sanitize_like(query_params[:q])}%") if query_params[:q].present?
        scope = filter_by_status(scope, query_params[:status]) if query_params[:status].present?
        scope = scope.order(sort_clause)

        candidates = paginate(scope)

        json_response(
          candidates: candidates.map(&method(:candidate_json)),
          meta: pagination_meta(candidates)
        )
      end

      private

      def filter_by_status(scope, status)
        case status
        when 'awaiting'  then scope.where(status: 'pending')
        when 'live'      then scope.where(status: 'active')
        when 'completed' then scope.where(status: 'ended').where.not(end_reason: 'error')
        when 'failed'    then scope.where(status: 'ended', end_reason: 'error')
        else scope
        end
      end

      def sort_clause
        case query_params[:sort]
        when 'oldest' then { created_at: :asc }
        when 'name'   then 'candidate_name ASC NULLS LAST'
        else              { created_at: :desc }
        end
      end

      def candidate_json(session)
        {
          id:               session.id,
          candidate_id:     session.candidate_id,
          candidate_name:   session.candidate_name,
          assessment_id:    session.assessment_id,
          assessment_name:  session.assessment.name,
          status:           session.status,
          end_reason:       session.end_reason,
          portfolio_status: session.portfolio&.generation_status,
          started_at:       session.started_at,
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

      def sanitize_like(value)
        value.to_s.gsub(/[%_\\]/) { |m| "\\#{m}" }
      end
    end
  end
end
