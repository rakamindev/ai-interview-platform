# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete create_snapshot record_consent]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete create_snapshot record_consent]

      MAX_SNAPSHOTS_PER_SESSION = 12

      before_action :set_session, only: %i[show update destroy end_session extend_invite coverage transcript snapshots]

      # GET /api/v1/assessments/:assessment_id/sessions
      def index
        assessment = Assessment.find(params[:assessment_id])
        sessions = paginate(assessment.sessions.order(created_at: :desc))

        json_response(
          sessions: sessions.map(&method(:session_json)),
          meta: pagination_meta(sessions)
        )
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # POST /api/v1/assessments/:assessment_id/sessions
      def create
        assessment = Assessment.find(params[:assessment_id])

        expiry_days = params.dig(:session, :invite_expiry_days).presence&.to_i || 7

        session = assessment.sessions.new(
          candidate_id:      params.dig(:session, :candidate_id),
          candidate_name:    params.dig(:session, :candidate_name).presence,
          tenant_id:         current_tenant_id,
          invite_expires_at: Time.current + expiry_days.days
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

      # PATCH /api/v1/sessions/:id
      def update
        if @session.update(candidate_name: params.dig(:session, :candidate_name))
          json_response(session: session_json(@session))
        else
          json_error(@session.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/sessions/:id
      def destroy
        if @session.active?
          return json_error("Can't delete a session that's live.", :unprocessable_entity)
        end

        @session.destroy
        json_response(message: "Session deleted")
      end

      # POST /api/v1/sessions/:id/extend_invite
      def extend_invite
        unless @session.pending?
          return json_error("Can only extend an invite that hasn't started yet", :unprocessable_entity)
        end

        @session.extend_invite!(params[:days].presence || 7)
        json_response(session: session_json(@session))
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

      # GET /api/v1/sessions/:id/snapshots
      def snapshots
        json_response(
          snapshots: @session.session_snapshots.order(:captured_at).map(&method(:snapshot_json))
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i
        turns     = @session.transcript_turns
                             .ordered
                             .then { from_turn > 0 ? _1.where("turn_number >= ?", from_turn) : _1 }

        json_response(turns: turns.map(&method(:transcript_turn_json)), total: turns.count)
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

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        session = Session.unscoped.find_by(invite_token: params[:token])

        if !session || session.expired?
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
          session_id:      session.id,
          role_title:      assessment.name,
          time_limit_min:  assessment.time_limit_min,
          session_status:  session.status,
          candidate_name:  session.candidate_name,
          started_at:      session.started_at,
          transcript:      session.active? ? session.transcript_turns.ordered.map(&method(:transcript_turn_json)) : []
        )
      end

      # POST /sessions/:token/consent — no JWT, invite token in URL
      def record_consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        session.update!(proctoring_consented_at: Time.current) if session.proctoring_consented_at.blank?
        json_response(proctoring_consented_at: session.proctoring_consented_at)
      end

      # POST /sessions/:token/snapshot — no JWT, invite token in URL
      def create_snapshot
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        unless session.proctoring_consented_at.present?
          return json_error("Proctoring consent has not been recorded for this session", :forbidden)
        end

        if session.session_snapshots.count >= MAX_SNAPSHOTS_PER_SESSION
          return json_response({ message: "Snapshot cap reached" })
        end

        session.session_snapshots.create!(captured_at: Time.current, image_data: params[:image])
        json_response({ message: "Snapshot saved" }, :created)
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
          created_at:       session.created_at,
          expired:          session.expired?,
          invite_expires_at: session.invite_expires_at
        }
      end

      def transcript_turn_json(turn)
        {
          id:             turn.id,
          turn_number:    turn.turn_number,
          speaker:        turn.speaker,
          text:           turn.text,
          audio_start_ms: turn.audio_start_ms,
          audio_end_ms:   turn.audio_end_ms,
          created_at:     turn.created_at
        }
      end

      def snapshot_json(snapshot)
        {
          id:          snapshot.id,
          captured_at: snapshot.captured_at,
          image_data:  snapshot.image_data
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
