# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor,
                            except: %i[candidate_info audio_complete consent]

      skip_before_action :require_tenant!,
                         only: %i[candidate_info audio_complete consent]

      before_action :set_session, only: %i[show end_session coverage transcript revoke_invite reissue_invite]
      before_action :set_candidate_session, only: %i[candidate_info audio_complete consent]

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

      # POST /api/v1/sessions/:id/revoke_invite
      # Kills a pending link. Live interviews are ended explicitly instead, so
      # revoking can never hide an in-progress session from the assessor.
      def revoke_invite
        if @session.active?
          return json_error("Cannot revoke an invite while the interview is in progress", :unprocessable_entity)
        end

        if @session.invite_consumed?
          return json_error("This invite is already completed and cannot be revoked", :unprocessable_entity)
        end

        @session.revoke_invite!
        json_response(session: session_json(@session))
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      # POST /api/v1/sessions/:id/reissue_invite
      # Rotates the token and starts a fresh expiry window.
      def reissue_invite
        if @session.active?
          return json_error("Cannot reissue an invite while the interview is in progress", :unprocessable_entity)
        end

        if @session.invite_consumed?
          return json_error("This session has already been used and cannot be reissued", :unprocessable_entity)
        end

        @session.reissue_invite!
        json_response(session: session_json(@session), invite_url: @session.invite_url)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
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

      # POST /sessions/:token/consent  — no JWT, invite token in URL
      # Records explicit consent before any audio/transcript is captured (UU PDP).
      def consent
        return invite_error(@session) unless @session.invite_usable?

        @session.record_consent!
        json_response(consent_given_at: @session.consent_given_at, consent_required: false)
      end

      # POST /sessions/:token/audio_complete  — no JWT, invite token in URL
      # Called by the frontend when the audio queue drains after a preparing_to_end signal.
      # Ends the session if all coverage is complete; idempotent if already ended.
      def audio_complete
        # Idempotent: a retry after a successful end must not 410.
        return json_response(ended: true, message: "Session already ended") if @session.ended?

        # A live session may finish its own audio; only a dead link is rejected.
        if @session.invite_revoked? || @session.invite_expired?
          return invite_error(@session)
        end

        # No coverage re-check here. The backend WS already verified all_covered
        # before sending preparing_to_end. Re-checking here caused false negatives
        # (timing gap between WS detection and HTTP call) that stalled auto-end.
        Sessions::EndHandler.new(@session).call(reason: 'all_covered')
        json_response(ended: true, message: "Session ended")
      end

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        return invite_error(@session) unless @session.invite_usable?

        assessment = Assessment.unscoped
                               .where(tenant_id: @session.tenant_id)
                               .find_by(id: @session.assessment_id)

        unless assessment
          return json_error("Assessment not found", :not_found, code: 'assessment_not_found')
        end

        json_response(
          session_id:       @session.id,
          role_title:       assessment.name,
          time_limit_min:   assessment.time_limit_min,
          language:         assessment.language.presence || 'en',
          session_status:   @session.status,
          invite_status:    @session.invite_status,
          expires_at:       @session.invite_expires_at,
          consent_required: @session.consent_given_at.nil?,
          consent_given_at: @session.consent_given_at
        )
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def set_candidate_session
        @session = Session.unscoped.find_by(invite_token: params[:token])
        return if @session

        json_error("This interview link is not valid.", :not_found, code: 'invite_not_found')
      end

      # Renders the precise reason a link cannot be used. The candidate UI maps
      # these codes to honest, actionable states instead of a fake "completed".
      def invite_error(session)
        code, message =
          if session.invite_revoked?
            ['invite_revoked', 'This interview link has been revoked by the hiring team.']
          elsif session.invite_expired?
            ['invite_expired', 'This interview link has expired.']
          elsif session.ended?
            ['invite_completed', 'This interview has already been completed.']
          elsif session.active?
            ['invite_in_progress', 'This interview is already in progress.']
          else
            ['invite_unavailable', 'This interview link is no longer available.']
          end

        json_error(message, :gone, code: code)
      end

      def session_json(session)
        {
          id:                   session.id,
          assessment_id:        session.assessment_id,
          tenant_id:            session.tenant_id,
          candidate_id:         session.candidate_id,
          candidate_name:       session.candidate_name,
          invite_token:         session.invite_token,
          invite_url:           session.invite_url,
          invite_status:        session.invite_status,
          invite_expires_at:    session.invite_expires_at,
          invite_revoked_at:    session.invite_revoked_at,
          invite_reissued_count: session.invite_reissued_count,
          consent_given_at:     session.consent_given_at,
          status:               session.status,
          end_reason:           session.end_reason,
          started_at:           session.started_at,
          ended_at:             session.ended_at,
          duration_seconds:     session.duration_seconds,
          created_at:           session.created_at
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
