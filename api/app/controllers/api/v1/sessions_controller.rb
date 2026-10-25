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

        json_response(sessions: sessions.map(&method(:session_json)))
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # POST /api/v1/assessments/:assessment_id/sessions
      def create
        assessment = Assessment.find(params[:assessment_id])

        if assessment.assessment_skills.empty?
          return json_error("Assessment must include at least one skill before inviting a candidate", :unprocessable_entity)
        end

        session = assessment.sessions.new(
          candidate_id:   params.dig(:session, :candidate_id),
          candidate_name: params.dig(:session, :candidate_name).presence,
          tenant_id:      current_tenant_id
        )

        if session.save
          json_response(
            {
              session:    session_json(session),
              invite_url: session.invite_url
            },
            :created
          )
        else
          json_error(session.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # GET /api/v1/sessions/:id
      def show
        json_response(
          session: session_json(@session).merge(
            assessment: {
              id:             @session.assessment.id,
              name:           @session.assessment.name,
              time_limit_min: @session.assessment.time_limit_min
            }
          )
        )
      end

      # POST /api/v1/sessions/:id/end
      def end_session
        if @session.ended?
          return json_error("Session is already ended", :unprocessable_entity)
        end

        reason = params.dig(:session, :reason) || "manual_assessor"

        unless Session::END_REASONS.include?(reason)
          return json_error("Invalid end reason", :unprocessable_entity)
        end

        result = Sessions::EndHandler.new(@session).call(reason: reason)

        if result
          json_response(session: session_json(@session.reload))
        else
          json_error("Failed to end session", :unprocessable_entity)
        end
      end

      # GET /api/v1/sessions/:id/coverage
      def coverage
        maps       = @session.coverage_maps.configured.order(:id)
        discovered = @session.coverage_maps.discovered.order(:id)

        json_response(
          skills:     maps.map(&method(:coverage_map_json)),
          discovered: discovered.map(&method(:coverage_map_json)),
          updated_at: @session.coverage_maps.maximum(:updated_at)
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i
        turns     = @session.transcript_turns
                             .ordered
                             .then { from_turn > 0 ? _1.where("turn_number >= ?", from_turn) : _1 }

        json_response(
          turns: turns.map do |t|
            {
              id:             t.id,
              turn_number:    t.turn_number,
              speaker:        t.speaker,
              text:           t.text,
              audio_start_ms: t.audio_start_ms,
              audio_end_ms:   t.audio_end_ms,
              created_at:     t.created_at
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
        return json_error("Invalid or expired invite token", :not_found) unless session

        return json_response(ended: true, message: "Session already ended") if session.ended?

        # F-06 guard: only end when the WebSocket layer persisted a fresh
        # preparing_to_end proof (see Session#mark_preparing_to_end!).
        # Previously the endpoint trusted any caller holding the invite token —
        # a leaked token (referrer, history, proxy logs) could force-end an
        # active session and generate a portfolio from a partial transcript.
        unless session.preparing_to_end?
          Rails.logger.warn("[audio_complete] Rejected end for session #{session.id}: no valid preparing_to_end flag")
          return json_error("Session is not ready to end", :conflict)
        end

        Sessions::EndHandler.new(session).call(reason: 'all_covered')
        json_response(ended: true, message: "Session ended")
      end

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        session = Session.unscoped.find_by(invite_token: params[:token])

        unless session
          return json_error("Invalid or expired invite token", :not_found)
        end

        # Resolve tenant from the session's own tenant_id so we can load the assessment
        assessment = Assessment.unscoped
                               .where(tenant_id: session.tenant_id)
                               .find_by(id: session.assessment_id)

        unless assessment
          return json_error("Assessment not found", :not_found)
        end

        deadline = if session.started_at
                     session.started_at + assessment.time_limit_min.minutes
                   end
        recent_turns = if session.active?
                         session.transcript_turns.order(turn_number: :desc).limit(20).to_a.reverse
                       else
                         []
                       end
        resume_available = !session.active? || session.gemini_resumption_token.present?

        json_response(
          session_id:      session.id,
          role_title:      assessment.name,
          time_limit_min:  assessment.time_limit_min,
          session_status:  session.status,
          deadline_at:     deadline&.iso8601,
          remaining_seconds: deadline ? [(deadline - Time.current).ceil, 0].max : nil,
          resume_available: resume_available,
          recovery_message: resume_available ? nil : 'The prior AI conversation context is unavailable.',
          recent_transcript: recent_turns.map do |turn|
            {
              id: turn.id,
              turn_number: turn.turn_number,
              speaker: turn.speaker,
              text: turn.text,
              created_at: turn.created_at
            }
          end
        )
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def session_json(session)
        {
          id:               session.id,
          assessment_id:    session.assessment_id,
          tenant_id:        session.tenant_id,
          candidate_id:     session.candidate_id,
          candidate_name:   session.candidate_name,
          invite_token:     session.invite_token,
          invite_url:       session.invite_url,
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          created_at:       session.created_at
        }
      end

      def coverage_map_json(map)
        {
          id:            map.id,
          skill_id:      map.skill_id,
          skill_label:   map.skill_label,
          is_discovered: map.is_discovered,
          state:         map.state,
          probe_count:   map.probe_count,
          last_signal:   map.last_signal,
          updated_at:    map.updated_at
        }
      end
    end
  end
end
