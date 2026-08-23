# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete]

      before_action :set_session, only: %i[show end_session coverage transcript]

      # GET /api/v1/assessments/:assessment_id/sessions
      def index
        assessment = Assessment.find(params[:assessment_id])
        sessions = assessment.sessions.order(created_at: :desc)

        json_response(sessions: sessions.map { |s| SessionSerializer.render(s) })
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found, code: "assessment_not_found")
      end

      # GET /api/v1/sessions/:id
      def show
        json_response(
          session: SessionSerializer.render(@session).merge(
            assessment: {
              id: @session.assessment.id,
              name: @session.assessment.name,
              time_limit_min: @session.assessment.time_limit_min
            }
          )
        )
      end

      # POST /api/v1/assessments/:assessment_id/sessions
      def create
        assessment = Assessment.find(params[:assessment_id])

        session = assessment.sessions.new(
          candidate_id: params.dig(:session, :candidate_id),
          candidate_name: params.dig(:session, :candidate_name).presence,
          tenant_id: current_tenant_id
        )

        if session.save
          json_response(
            {
              session: SessionSerializer.render(session),
              invite_url: session.invite_url
            },
            :created
          )
        else
          json_error(session.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found, code: "assessment_not_found")
      end

      # POST /api/v1/assessments/:assessment_id/sessions/bulk_create
      def bulk_create
        assessment = Assessment.find(params[:assessment_id])
        candidates = params.require(:candidates)

        unless candidates.is_a?(Array) && candidates.present?
          return json_error("candidates must be a non-empty array", :unprocessable_entity, code: "candidates_required")
        end

        if candidates.size > 100
          return json_error("Maximum 100 candidates per request", :unprocessable_entity, code: "candidates_too_many")
        end

        results = Sessions::BulkInviter.new(
          assessment: assessment,
          candidates: candidates,
          tenant_id: current_tenant_id
        ).call

        json_response(
          {
            results: results.map do |r|
              {
                identifier: r.identifier,
                success: r.success,
                session_id: r.session&.id,
                invite_url: r.session&.invite_url,
                error: r.error
              }
            end,
            summary: {
              total: results.size,
              successful: results.count(&:success),
              failed: results.count { |r| !r.success }
            }
          },
          :ok
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found, code: "assessment_not_found")
      end

      # POST /api/v1/sessions/:id/end
      def end_session
        return json_error("Session is already ended", :unprocessable_entity, code: "session_already_ended") if @session.ended?

        reason = params.dig(:session, :reason) || "manual_assessor"

        return json_error("Invalid end reason", :unprocessable_entity, code: "invalid_end_reason") unless Session::END_REASONS.include?(reason)

        result = Sessions::EndHandler.new(@session).call(reason: reason)

        if result
          json_response(session: SessionSerializer.render(@session.reload))
        else
          json_error("Failed to end session", :unprocessable_entity, code: "session_end_failed")
        end
      end

      # GET /api/v1/sessions/:id/coverage
      def coverage
        maps       = @session.coverage_maps.configured.order(:id)
        discovered = @session.coverage_maps.discovered.order(:id)

        json_response(
          skills: maps.map(&method(:coverage_map_json)),
          discovered: discovered.map(&method(:coverage_map_json)),
          updated_at: @session.coverage_maps.maximum(:updated_at)
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i
        turns     = @session.transcript_turns
          .ordered
          .then { from_turn.positive? ? _1.where(turn_number: from_turn..) : _1 }

        json_response(
          turns: turns.map do |t|
            {
              id: t.id,
              turn_number: t.turn_number,
              speaker: t.speaker,
              text: t.text,
              audio_start_ms: t.audio_start_ms,
              audio_end_ms: t.audio_end_ms,
              created_at: t.created_at
            }
          end,
          total: turns.count
        )
      end

      # POST /sessions/:token/audio_complete  — no JWT, invite token in URL
      # Called by the frontend when the audio queue drains after a preparing_to_end signal.
      # Ends the session if all coverage is complete; idempotent if already ended.
      def audio_complete
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found, code: "invite_invalid") unless session
        return json_error("Invite token has expired", :unauthorized, code: "invite_expired") unless session.invite_valid?

        return json_response(ended: true, message: "Session already ended") if session.ended?

        # No coverage re-check here. The backend WS already verified all_covered
        # before sending preparing_to_end. Re-checking here caused false negatives
        # (timing gap between WS detection and HTTP call) that stalled auto-end.
        Sessions::EndHandler.new(session).call(reason: "all_covered")
        json_response(ended: true, message: "Session ended")
      end

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        session = Session.unscoped.find_by(invite_token: params[:token])

        return json_error("Invalid or expired invite token", :not_found, code: "invite_invalid") unless session

        return json_error("Invite token has expired", :unauthorized, code: "invite_expired") unless session.invite_valid?

        # Resolve tenant from the session's own tenant_id so we can load the assessment
        assessment = Assessment.unscoped
          .where(tenant_id: session.tenant_id)
          .find_by(id: session.assessment_id)

        return json_error("Assessment not found", :not_found, code: "assessment_not_found") unless assessment

        json_response(
          session_id: session.id,
          role_title: assessment.name,
          time_limit_min: assessment.time_limit_min,
          session_status: session.status
        )
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found, code: "not_found")
      end

      def coverage_map_json(map)
        {
          id: map.id,
          skill_id: map.skill_id,
          skill_label: map.skill_label,
          is_discovered: map.is_discovered,
          state: map.state,
          probe_count: map.probe_count,
          last_signal: map.last_signal,
          updated_at: map.updated_at
        }
      end
    end
  end
end
