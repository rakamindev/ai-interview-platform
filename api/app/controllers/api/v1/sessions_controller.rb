# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info candidate_biodata audio_complete]
      skip_before_action :require_tenant!, only: %i[candidate_info candidate_biodata audio_complete]

      before_action :set_session, only: %i[show end_session coverage transcript]

      # GET /api/v1/assessments/:assessment_id/sessions
      # GET /api/v1/assessments/:assessment_id/sessions?q=budi&page=2
      def index
        assessment = Assessment.find(params[:assessment_id])
        scope = assessment.sessions.includes(:candidate)

        if params[:q].present?
          scope = scope.joins(:candidate)
                       .where('candidates.name ILIKE :q OR candidates.email ILIKE :q', q: "%#{params[:q]}%")
        end

        sessions = paginate(scope.order(created_at: :desc))

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

        email = params.dig(:session, :candidate_email).to_s.strip
        return json_error("Candidate email is required", :unprocessable_entity) if email.blank?

        candidate = Candidate.find_or_initialize_by(tenant_id: current_tenant_id, email: email.downcase)
        candidate.name  = params.dig(:session, :candidate_name).presence || candidate.name
        candidate.phone = params.dig(:session, :candidate_phone).presence || candidate.phone

        unless candidate.save
          return json_error(candidate.errors.full_messages.first, :unprocessable_entity)
        end

        session = assessment.sessions.new(
          candidate:      candidate,
          candidate_name: candidate.name,
          expires_at:     parse_expires_at(params.dig(:session, :expires_at)),
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

        if session.expired?
          return json_error("This invite link has expired", :gone)
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
          candidate_name:  session.candidate&.name,
          candidate_email: session.candidate&.email,
          candidate_phone: session.candidate&.phone,
          candidate_address: session.candidate&.address,
          cv_attached:     session.candidate&.cv&.attached? || false
        )
      end

      # POST /sessions/:token/biodata  — no JWT, invite token in URL
      # Step 2 of the candidate onboarding flow: contact info + CV upload.
      def candidate_biodata
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session
        return json_error("This invite link has expired", :gone) if session.expired?

        candidate = session.candidate
        return json_error("No candidate associated with this session", :unprocessable_entity) unless candidate

        candidate.name    = params[:name].presence    || candidate.name
        candidate.phone   = params[:phone].presence   || candidate.phone
        candidate.address = params[:address].presence || candidate.address

        if candidate.save
          candidate.cv.attach(params[:cv]) if params[:cv].present?
          json_response(message: "Biodata saved")
        else
          json_error(candidate.errors.full_messages.first, :unprocessable_entity)
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
          candidate_email:  session.candidate&.email,
          candidate_phone:  session.candidate&.phone,
          invite_token:     session.invite_token,
          invite_url:       session.invite_url,
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          expires_at:       session.expires_at,
          expired:          session.expired?,
          created_at:       session.created_at
        }
      end

      # Accepts a bare date ("2026-08-25") or full ISO datetime; a bare date
      # is treated as end-of-day so the link stays valid through that whole day.
      def parse_expires_at(raw)
        return nil if raw.blank?

        parsed = Time.zone.parse(raw.to_s)
        parsed = parsed.end_of_day if raw.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
        parsed
      rescue ArgumentError
        nil
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
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
