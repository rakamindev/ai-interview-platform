# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete consent_policy consent]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete consent_policy consent]

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
      #
      # Hijack protection: anyone holding the invite link must not be able to
      # fabricate an "all covered" end for an interview that never happened —
      # that would persist an empty assessment as the candidate's official
      # result. We therefore require (a) explicit consent and (b) evidence the
      # session actually ran (active + at least one transcript turn). The error
      # message stays generic so no internal state leaks to the caller.
      def audio_complete
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        return json_response(ended: true, message: "Session already ended") if session.ended?

        unless session.consent_given? && session.active? && session.transcript_turns.exists?
          return json_error("Session cannot be completed at this time", :unprocessable_entity)
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

        consent = session.candidate_consent

        json_response(
          session_id:       session.id,
          role_title:       assessment.name,
          time_limit_min:   assessment.time_limit_min,
          session_status:   session.status,
          language:         assessment.language.presence || 'en',
          consent_required: true,
          consent_status:   consent&.status || 'pending',
          policy_version:   ConsentPolicy::POLICY_VERSION
        )
      end

      # GET /sessions/:token/consent — UU PDP disclosure shown to the candidate.
      def consent_policy
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        assessment = Assessment.unscoped
                               .where(tenant_id: session.tenant_id)
                               .find_by(id: session.assessment_id)
        language = assessment&.language.presence || 'en'

        json_response(
          policy_version: ConsentPolicy::POLICY_VERSION,
          language:       language,
          consent_status: session.candidate_consent&.status || 'pending',
          policy:         ConsentPolicy.content(language)
        )
      end

      # POST /sessions/:token/consent — record acceptance or refusal (UU PDP).
      # Idempotent: re-submitting updates the single per-session record.
      def consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        if session.ended?
          return json_error("Session has ended", :unprocessable_entity)
        end

        status = params.dig(:consent, :status).to_s
        unless %w[accepted declined].include?(status)
          return json_error("Invalid consent status", :unprocessable_entity)
        end

        consent = session.candidate_consent || session.build_candidate_consent(
          policy_version: ConsentPolicy::POLICY_VERSION
        )

        consent.status = status
        consent.consent_ip = request.remote_ip
        consent.consent_user_agent = request.user_agent.to_s.truncate(512)

        if status == 'accepted'
          consent.accepted_at = Time.current
          consent.declined_at = nil
        else
          consent.declined_at = Time.current
          consent.accepted_at = nil
        end

        if consent.save
          json_response(consent: consent_json(consent))
        else
          json_error(consent.errors.full_messages.first, :unprocessable_entity)
        end
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
          invite_url:       session.invite_url,
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          created_at:       session.created_at
        }
      end

      def consent_json(consent)
        {
          policy_version: consent.policy_version,
          status:         consent.status,
          accepted_at:    consent.accepted_at,
          declined_at:    consent.declined_at
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
