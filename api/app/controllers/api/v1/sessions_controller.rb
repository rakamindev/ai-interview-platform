# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete consent]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete consent]

      before_action :set_session, only: %i[show end_session reopen coverage transcript]

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

        session = assessment.sessions.new(
          candidate_id:    params.dig(:session, :candidate_id),
          candidate_name:  params.dig(:session, :candidate_name).presence,
          candidate_email: params.dig(:session, :candidate_email).presence,
          tenant_id:       current_tenant_id
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

      # POST /api/v1/assessments/:assessment_id/sessions/batch
      def batch
        assessment = Assessment.find(params[:assessment_id])
        candidates = params[:candidates] || params[:sessions] || []

        if candidates.blank? || !candidates.is_a?(Array)
          return json_error("Candidates list must be a non-empty array", :unprocessable_entity)
        end

        if candidates.length > 500
          return json_error("Batch size cannot exceed 500 candidates per upload", :unprocessable_entity)
        end

        created_sessions = []

        ActiveRecord::Base.transaction do
          candidates.each do |c|
            name  = c[:name].presence || c[:candidate_name].presence || "Candidate"
            email = c[:email].presence || c[:candidate_email].presence

            session = assessment.sessions.create!(
              tenant_id:       current_tenant_id,
              candidate_name:  name.to_s.strip,
              candidate_email: email&.to_s&.strip,
              candidate_id:    c[:candidate_id]
            )
            created_sessions << session
          end
        end

        json_response(
          {
            count:    created_sessions.length,
            sessions: created_sessions.map(&method(:session_json))
          },
          :created
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
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

      # POST /api/v1/sessions/:id/reopen
      def reopen
        unless @session.ended?
          return json_error("Only ended sessions can be reopened", :unprocessable_entity)
        end

        unless @session.end_reason == "error" || params[:force] == true
          return json_error("Only sessions ended due to connection or system errors can be reopened", :unprocessable_entity)
        end

        ActiveRecord::Base.transaction do
          @session.portfolio&.destroy

          @session.update!(
            status:                  "pending",
            end_reason:              nil,
            ended_at:                nil,
            duration_seconds:        nil,
            started_at:              nil,
            gemini_resumption_token: nil
          )
        end

        json_response(
          session: session_json(@session.reload),
          message: "Session successfully reopened. Candidate may now resume the interview."
        )
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
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

        # No coverage re-check here. The backend WS already verified all_covered
        # before sending preparing_to_end. Re-checking here caused false negatives
        # (timing gap between WS detection and HTTP call) that stalled auto-end.
        Sessions::EndHandler.new(session).call(reason: 'all_covered')
        json_response(ended: true, message: "Session ended")
      end

      # POST /sessions/:token/consent — no JWT, invite token in URL
      def consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        if session.ended?
          return json_error("Session is already ended", :unprocessable_entity)
        end

        version = params[:terms_version].presence || "2026.1"
        session.record_consent!(ip: request.remote_ip, version: version)

        json_response(
          consented:     true,
          consented_at:  session.consented_at,
          terms_version: session.terms_version
        )
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
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

        json_response(
          session_id:        session.id,
          role_title:        assessment.name,
          time_limit_min:    assessment.time_limit_min,
          remaining_seconds: session.remaining_seconds,
          started_at:        session.started_at,
          session_status:    session.status,
          end_reason:        session.end_reason,
          consented:         session.consented?,
          consented_at:      session.consented_at,
          terms_version:     session.terms_version
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
          candidate_email:  session.candidate_email,
          invite_token:     session.invite_token,
          invite_url:       session.invite_url,
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          consented_at:     session.consented_at,
          terms_version:    session.terms_version,
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
