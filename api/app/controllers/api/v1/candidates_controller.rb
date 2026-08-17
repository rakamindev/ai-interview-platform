# frozen_string_literal: true

module Api
  module V1
    class CandidatesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment

      # GET /api/v1/assessments/:assessment_id/candidates
      def index
        result = Candidates::Query.call(
          assessment:        @assessment,
          search:            query_params[:search],
          interview_status:  query_params[:interview_status],
          verdict:           query_params[:verdict],
          sort:              query_params[:sort],
          direction:         query_params[:direction]
        )

        return json_error(result.errors.join(', '), :unprocessable_entity) unless result.valid?

        candidates = paginate(result.relation)

        json_response(
          candidates: candidates.map(&method(:candidate_json)),
          meta: pagination_meta(candidates)
        )
      end

      # POST /api/v1/assessments/:assessment_id/candidates/export
      #
      # Bulk export is intentionally scoped to transcript/json for this
      # revamp. PDF export already exists per-candidate (portfolios#export);
      # looping it across a bulk selection is left as a documented follow-up
      # rather than shipped half-tested under this deadline.
      def export
        format = params[:format].to_s
        candidate_ids = Array(params[:candidate_ids]).reject(&:blank?).map(&:to_i)

        unless %w[transcript json].include?(format)
          return json_error("format must be 'transcript' or 'json'", :unprocessable_entity)
        end

        if candidate_ids.empty?
          return json_error("candidate_ids must be a non-empty array", :unprocessable_entity)
        end

        sessions = @assessment.sessions.where(id: candidate_ids)
        found_ids = sessions.pluck(:id)
        missing_ids = candidate_ids - found_ids

        results = sessions.map { |session| export_one(session, format) }
        missing_ids.each do |id|
          results << { candidate_id: id, status: "error", error: "Candidate does not belong to this assessment" }
        end

        json_response(exported_at: Time.current.iso8601, format: format, results: results)
      end

      private

      def export_one(session, format)
        format == "transcript" ? export_transcript(session) : export_json_payload(session)
      end

      def export_transcript(session)
        turns = session.transcript_turns.ordered
        {
          candidate_id:   session.id,
          candidate_name: session.candidate_name,
          status:         "ok",
          data: {
            turns: turns.map { |t| { turn_number: t.turn_number, speaker: t.speaker, text: t.text } }
          }
        }
      end

      def export_json_payload(session)
        portfolio = session.portfolio

        unless portfolio&.complete?
          return {
            candidate_id:   session.id,
            candidate_name: session.candidate_name,
            status:         "error",
            error:          "Portfolio not available for this candidate"
          }
        end

        {
          candidate_id:   session.id,
          candidate_name: session.candidate_name,
          status:         "ok",
          data: {
            verdict: portfolio.verdict,
            skills: portfolio.portfolio_skills.map do |skill|
              override = skill.assessor_override
              {
                skill_label:     skill.skill_label,
                ai_level:        skill.ai_level,
                effective_level: override ? override.override_level : skill.ai_level,
                ai_confidence:   skill.ai_confidence,
                overridden:      !!override
              }
            end
          }
        }
      end

      def set_assessment
        @assessment = Assessment.find(params[:assessment_id])
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      def candidate_json(session)
        {
          candidate_id:     session.id,
          candidate_name:   session.candidate_name,
          session_id:       session.id,
          session_status:   session.status,
          interview_status: interview_status_label(session.status),
          interview_date:   session.started_at,
          verdict:          session.portfolio&.verdict
        }
      end

      def interview_status_label(status)
        status == 'ended' ? 'completed' : status
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
