# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete consent consent_revoke
                                                  candidate_transcript candidate_data_delete]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete consent consent_revoke
                                                    candidate_transcript candidate_data_delete]

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

        # Consent gate — the candidate must have granted consent before the
        # session can complete (AC-B1).
        return json_error("Consent required to complete the session", :forbidden) unless session.consent_granted?

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
          session_id:      session.id,
          role_title:      assessment.name,
          time_limit_min:  assessment.time_limit_min,
          session_status:  session.status,
          consent_required: true,
          consent_version: Consent::CURRENT_VERSION,
          has_consent:      session.consent_granted?
        )
      end

      # POST /sessions/:token/consent — grant (no JWT, invite token in URL).
      # Idempotent: first grant → 201, repeat → 200 with the same record
      # (a revoked consent is re-granted in place, never duplicated).
      def consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        version = params[:version].to_s.presence
        return json_error("Consent version is required", :unprocessable_entity) unless version
        return json_error("Consent version mismatch — please review the latest disclosure", :unprocessable_entity) if version != Consent::CURRENT_VERSION

        existing = session.consent
        if existing&.granted?
          return json_response({ consent: consent_json(existing), status: 'granted' }, :ok)
        end

        if existing
          existing.update!(
            version: version, status: 'granted', granted_at: Time.current, revoked_at: nil,
            ip: request.remote_ip, user_agent: request.user_agent&.truncate(255),
            tenant_id: session.tenant_id
          )
          json_response({ consent: consent_json(existing), status: 'granted' }, :ok)
        else
          consent_record = session.build_consent(
            version: version, status: 'granted', granted_at: Time.current,
            ip: request.remote_ip, user_agent: request.user_agent&.truncate(255),
            tenant_id: session.tenant_id
          )

          if consent_record.save
            json_response({ consent: consent_json(consent_record), status: 'granted' }, :created)
          else
            json_error(consent_record.errors.full_messages.first, :unprocessable_entity)
          end
        end
      end

      # POST /sessions/:token/consent/revoke — revoke (no JWT, invite token in URL).
      def consent_revoke
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        consent_record = session.consent
        return json_error("No consent found for this session", :not_found) unless consent_record

        unless consent_record.revoked?
          consent_record.update!(status: 'revoked', revoked_at: Time.current)
        end

        json_response({ consent: consent_json(consent_record), status: 'revoked' }, :ok)
      end

      # GET /sessions/:token/candidate/transcript — candidate's own transcript (no JWT).
      # Only accessible while consent is granted (AC-B1).
      def candidate_transcript
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session
        return json_error("Consent required to access the transcript", :forbidden) unless session.consent_granted?

        turns = session.transcript_turns.ordered.map do |t|
          {
            id:             t.id,
            turn_number:    t.turn_number,
            speaker:        t.speaker,
            text:           t.text,
            audio_start_ms: t.audio_start_ms,
            audio_end_ms:   t.audio_end_ms,
            created_at:     t.created_at
          }
        end

        json_response(turns: turns, total: turns.size)
      end

      # DELETE /sessions/:token/data — schedule deletion of the candidate's data.
      # Idempotent; the job revokes consent, deletes transcript + portfolio and
      # nulls the candidate identity (AC-B3).
      def candidate_data_delete
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        CandidateDataDeletionJob.perform_async(session.id)
        json_response({ status: 'accepted', message: 'Data deletion scheduled' }, :accepted)
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

      def consent_json(consent_record)
        {
          version:    consent_record.version,
          status:     consent_record.status,
          granted_at: consent_record.granted_at,
          revoked_at: consent_record.revoked_at
        }
      end
    end
  end
end
