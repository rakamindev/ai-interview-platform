# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info give_consent audio_complete]
      skip_before_action :require_tenant!, only: %i[candidate_info give_consent audio_complete]

      before_action :set_session, only: %i[show destroy end_session coverage transcript]

      # GET /api/v1/assessments/:assessment_id/sessions
      def index
        # Skip gemini_resumption_token (large TEXT) — never exposed in lists.
        assessment = Assessment.find(params[:assessment_id])
        sessions = assessment.sessions
                             .select(:id, :assessment_id, :tenant_id, :candidate_id,
                                     :candidate_name, :invite_token, :status, :end_reason,
                                     :started_at, :ended_at, :duration_seconds, :created_at)
                             .order(created_at: :desc)

        json_response(sessions: serialize(sessions, with: SessionSerializer))
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
              session:    serialize(session, with: SessionSerializer),
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
          session: serialize(@session, with: SessionSerializer, include_assessment: true)
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
          json_response(session: serialize(@session.reload, with: SessionSerializer))
        else
          json_error("Failed to end session", :unprocessable_entity)
        end
      end

      # GET /api/v1/sessions/:id/coverage
      def coverage
        maps       = @session.coverage_maps.configured.order(:id)
        discovered = @session.coverage_maps.discovered.order(:id)

        json_response(
          skills:     serialize(maps,       with: CoverageMapSerializer),
          discovered: serialize(discovered, with: CoverageMapSerializer),
          updated_at: @session.coverage_maps.maximum(:updated_at)
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i
        # Select only serialized columns.
        turns     = @session.transcript_turns
                            .select(:id, :turn_number, :speaker, :text,
                                    :audio_start_ms, :audio_end_ms, :created_at)
                            .ordered
                            .then { from_turn > 0 ? _1.where("turn_number >= ?", from_turn) : _1 }

        json_response(
          turns: turns.map { |t| TranscriptTurnSerializer.new(t).as_json },
          # count(:all): plain .count would build COUNT(<selected columns>) and fail.
          total: turns.count(:all)
        )
      end

      # DELETE /api/v1/sessions/:id
      # UU PDP right to erasure: removes the session and all personal-data
      # cascades (transcript turns, coverage maps, portfolio, fit/gap reports).
      # Defense-in-depth: only ended sessions are erasable — matches the
      # retention task scope; live/pending interviews must be ended first.
      def destroy
        unless @session.ended?
          return json_error("Only ended sessions can be deleted — end the session first", :unprocessable_entity)
        end

        @session.destroy!
        json_response(message: "Session deleted")
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
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
          consent_given:   session.consent_given_at.present?
        )
      end

      # POST /sessions/:token/consent — no JWT, invite-token identity.
      # Records the moment a candidate agreed to data processing (UU PDP
      # lawful basis). Idempotent with first-write-wins so the timestamp can
      # never be rolled back by a later request.
      def give_consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        session.update(consent_given_at: Time.current) if session.consent_given_at.nil?
        json_response(consent_recorded: true)
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end
    end
  end
end
