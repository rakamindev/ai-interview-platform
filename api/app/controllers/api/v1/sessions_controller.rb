# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete update_candidate]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete update_candidate]

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
          cv_text = params.dig(:session, :cv_text).presence || params[:cv_text].presence
          ingest_candidate_cv(session, cv_text) if cv_text.present?

          json_response(
            {
              session:    session_json(session),
              invite_url: resolved_invite_url(session)
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

        # Resolve tenant from the session's own tenant_id so we can load the assessment
        assessment = Assessment.unscoped
                               .where(tenant_id: session.tenant_id)
                               .find_by(id: session.assessment_id)

        unless assessment
          return json_error("Assessment not found", :not_found)
        end

        json_response(
          session_id:      session.id,
          candidate_name:  session.candidate_name,
          consent_given:   session.consent_at.present?,
          role_title:      assessment.name,
          time_limit_min:  assessment.time_limit_min,
          session_status:  session.status,
          end_reason:      session.end_reason
        )
      end

      # PATCH /sessions/:token/candidate — no JWT, invite token in URL
      def update_candidate
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        return json_error("Cannot update candidate for ended session", :unprocessable_entity) if session.ended?

        update_attrs = {}
        update_attrs[:candidate_name] = params[:candidate_name].to_s.strip if params.key?(:candidate_name)
        update_attrs[:consent_at] = Time.current if params[:consent] == true || params[:consent] == 'true'

        session.update!(update_attrs)
        json_response(
          session_id:     session.id,
          candidate_name: session.candidate_name,
          consent_given:  session.consent_at.present?,
          message:        "Candidate identity and consent updated successfully"
        )
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def ingest_candidate_cv(session, cv_text)
        return if cv_text.blank?

        parsed = Cv::ParserService.call(cv_text)
        chunks = Cv::ChunkingService.call(parsed[:clean_text])
        embedding_client = Gemini::EmbeddingClient.new(organization: session.tenant || Organization.find_by(id: session.tenant_id))

        chunks.each_with_index do |chunk, idx|
          embedding = embedding_client.embed(chunk[:content]) rescue []
          session.candidate_cv_chunks.create!(
            chunk_index: idx,
            section_type: chunk[:section_type] || 'projects',
            content: chunk[:content],
            metadata: chunk[:metadata] || {},
            embedding: embedding.present? ? "[#{embedding.join(',')}]" : nil
          )
        end
      rescue StandardError => e
        Rails.logger.warn("[SessionsController] CV ingestion failed for session #{session.id}: #{e.message}")
      end

      def session_json(session)
        {
          id:               session.id,
          assessment_id:    session.assessment_id,
          tenant_id:        session.tenant_id,
          candidate_id:     session.candidate_id,
          candidate_name:   session.candidate_name,
          invite_token:     session.invite_token,
          invite_url:       resolved_invite_url(session),
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          created_at:       session.created_at
        }
      end

      def resolved_invite_url(session)
        origin = request.headers['Origin'].presence ||
                 request.headers['Referer']&.then { |r| URI.parse(r).origin rescue nil }
        session.invite_url(origin)
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
