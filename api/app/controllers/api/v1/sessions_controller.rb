# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      # Candidate-facing actions are authenticated by the invite token embedded in
      # the URL — a capability the candidate holds instead of a JWT. They must also
      # skip the tenant filter: a candidate's browser has no JWT to read a `scheme`
      # claim from, so tenant resolution would always fail before the action ran.
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete upload_cv mine]
      # The candidate dashboard is the one authenticated action here: a signed-in
      # candidate (role "user") lists their own interviews, so it accepts any role.
      authorize_auth_token! :any, only: %i[mine]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete upload_cv]

      MAX_CV_BYTES            = 5.megabytes
      ALLOWED_CV_EXTENSIONS   = %w[.pdf .txt].freeze
      ALLOWED_CV_CONTENT_TYPE = %w[application/pdf text/plain application/octet-stream].freeze

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

      # POST /sessions/:token/audio_complete — no JWT, invite token in URL
      # Called by the frontend when the audio queue drains after a preparing_to_end
      # signal, and as the HTTP fallback if the candidate explicitly ends the
      # interview while the WebSocket is already down.
      # Idempotent: safe to retry, returns 200 if the session has already ended.
      def audio_complete
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        return json_response(ended: true, message: "Session already ended") if session.ended?

        # No coverage re-check here. The backend WS already verified all_covered
        # before sending preparing_to_end. Re-checking here caused false negatives
        # (timing gap between WS detection and HTTP call) that stalled auto-end.
        #
        # reason is deliberately a two-value whitelist, not params[:reason]
        # verbatim: the invite token is a capability URL, so anything it sends
        # must still not be able to write an arbitrary end_reason.
        reason = params[:reason].to_s == 'manual_candidate' ? 'manual_candidate' : 'all_covered'
        Sessions::EndHandler.new(session).call(reason: reason)
        json_response(ended: true, message: "Session ended")
      end

      # GET /api/v1/candidate/sessions — the signed-in candidate's own interviews
      #
      # Backs the candidate dashboard: upcoming (pending), in progress (active),
      # completed (ended) and not-completed (failed) interviews, newest first.
      # Scoped to the caller, so a candidate can never enumerate anyone else's.
      def mine
        user = User.find_by(id: current_user&.id)
        return json_response(sessions: []) unless user

        sessions = Session
                   .for_candidate(user)
                   .includes(:assessment, :portfolio)
                   .with_attached_cv
                   .order(created_at: :desc)

        json_response(sessions: sessions.map { |session| candidate_session_json(session) })
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
          has_cv:          session.cv.attached? || session.cv_text.present?,
          has_cv_text:     session.cv_text.present?,
          cv_filename:     session.cv.attached? ? session.cv.filename.to_s : nil
        )
      end

      # POST /sessions/:token/cv — upload CV before interview starts
      #
      # Candidate-facing: the invite token is the only credential, so this action is
      # skipped by both the assessor JWT filter and the tenant filter (see the top of
      # this class). The session row is loaded unscoped because no tenant is resolved.
      def upload_cv
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session
        return json_error("Cannot upload a CV to a session that has already ended", :unprocessable_entity) if session.ended?

        file = params[:cv]
        unless file.respond_to?(:original_filename) && file.respond_to?(:read)
          return json_error(
            "CV file is required. Send it as multipart/form-data in the 'cv' field.",
            :bad_request
          )
        end

        error = cv_validation_error(file)
        return json_error(error, :unprocessable_entity) if error

        # attach (not attach+purge) keeps the previous CV until the new blob is stored,
        # so a failed re-upload never leaves the session without a résumé.
        session.cv.attach(file)
        extracted_text = CvParserService.extract_text(session.cv)
        session.update!(cv_text: extracted_text)

        json_response(
          success:        true,
          filename:       session.cv.filename.to_s,
          text_length:    extracted_text.length,
          text_extracted: extracted_text.length.positive?,
          preview:        extracted_text.truncate(200)
        )
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("[upload_cv] RecordInvalid: #{e.record.errors.full_messages.join(', ')}")
        json_error("CV upload failed: #{e.record.errors.full_messages.first}", :unprocessable_entity)
      rescue StandardError => e
        Rails.logger.error("[upload_cv] #{e.class}: #{e.message}")
        json_error("CV upload failed. Please try a different file.", :unprocessable_entity)
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      # Returns a human-readable reason the upload is unacceptable, or nil when it is fine.
      # Validated here rather than only in the browser: the invite URL is a capability,
      # so the file reaching this action is not guaranteed to have passed the UI checks.
      def cv_validation_error(file)
        filename     = file.original_filename.to_s
        extension    = File.extname(filename).downcase
        content_type = file.content_type.to_s.downcase

        unless ALLOWED_CV_EXTENSIONS.include?(extension)
          return "Only PDF and TXT files are supported."
        end

        if content_type.present? && !ALLOWED_CV_CONTENT_TYPE.include?(content_type)
          return "Unsupported file type '#{content_type}'. Upload a PDF or TXT file."
        end

        size = file.size.to_i
        return "CV file is empty." if size.zero?
        return "CV file is too large. The maximum size is #{MAX_CV_BYTES / 1.megabyte}MB." if size > MAX_CV_BYTES

        nil
      end

      # Dashboard projection: what a candidate needs to see, and nothing that
      # belongs to the assessor view (no tenant_id, no internal ids beyond the
      # assessment they are already interviewing for).
      def candidate_session_json(session)
        {
          id:               session.id,
          invite_token:     session.invite_token,
          invite_url:       session.invite_url,
          assessment_id:    session.assessment_id,
          role_title:       session.assessment&.name,
          time_limit_min:   session.assessment&.time_limit_min,
          status:           session.status,
          end_reason:       session.end_reason,
          created_at:       session.created_at,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          has_cv:           session.cv.attached? || session.cv_text.present?,
          has_report:       session.portfolio.present?
        }
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
