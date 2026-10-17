# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :assessor, except: %i[candidate_info audio_complete consent revoke_consent]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete consent revoke_consent]

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
          consent_status:  session.consent_status,
          consent_version: session.consent_version || Session::CONSENT_VERSION,
          consent_text:    consent_text(assessment)
        )
      end

      # POST /sessions/:token/consent — record explicit consent (invite token only)
      def consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        if session.ended?
          return json_error("Session has already ended; use the data-request path for any further actions", :conflict)
        end

        if session.consent_revoked?
          return json_error("Consent was withdrawn and cannot be re-given for this session", :unprocessable_entity)
        end

        version = params[:consent_version].to_s.presence || Session::CONSENT_VERSION

        unless version == Session::CONSENT_VERSION
          return json_error(
            "Consent version out of date. Current version: #{Session::CONSENT_VERSION}",
            :unprocessable_entity
          )
        end

        session.grant_consent!(version: version, consent_text: consent_text(session.assessment))
        json_response(consent_status: session.reload.consent_status, consented_at: session.consented_at)
      end

      # POST /sessions/:token/consent/revoke — withdraw consent before the interview starts
      def revoke_consent
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        if session.ended?
          return json_error("Session has already ended; data deletion requests go through the data-subject request path", :conflict)
        end

        session.revoke_consent!
        json_response(consent_status: session.reload.consent_status, consent_revoked_at: session.consent_revoked_at)
      end

      private

      CONSENT_TEXT_EN = <<~TEXT.freeze
        Your consent matters. Before this interview starts, please read this carefully.

        WHAT WE COLLECT
        - Your voice recording and the transcript of your answers, used to assess your skills for this application.

        WHY
        - The evaluation of your responses against the role's skill levels, so the hiring team can make an informed decision.

        HOW LONG WE KEEP IT
        - We retain this data for the hiring period defined by the company, then delete or anonymise it.

        WHO CAN SEE IT
        - The hiring team and our AI service provider (Google Gemini). Your data may be processed outside Indonesia for transcription and evaluation.

        YOUR RIGHTS
        - You can ask to access, correct, or delete your data, and you can withdraw this consent at any time before the interview. After the interview ends, data-deletion requests go through a separate data-subject request path.

        By accepting, you confirm you have read and understood this notice.
      TEXT

      CONSENT_TEXT_ID = <<~TEXT.freeze
        Persetujuan Anda penting. Sebelum wawancara dimulai, mohon baca dengan saksama.

        DATA YANG KAMI KUMPULKAN
        - Rekaman suara dan transkrip jawaban Anda, digunakan untuk menilai keterampilan Anda untuk lamaran ini.

        TUJUAN
        - Evaluasi jawaban Anda terhadap tingkat keterampilan yang dibutuhkan posisi, agar tim perekrut dapat mengambil keputusan yang tepat.

        LAMA PENYIMPANAN
        - Kami menyimpan data ini selama periode perekrutan yang ditetapkan perusahaan, lalu menghapus atau menganonimkannya.

        SIAPA YANG DAPAT MELIHAT
        - Tim perekrut dan penyedia layanan AI kami (Google Gemini). Data Anda dapat diproses di luar Indonesia untuk transkripsi dan evaluasi.

        HAK ANDA
        - Anda dapat meminta akses, perbaikan, atau penghapusan data Anda, dan dapat menarik persetujuan ini kapan saja sebelum wawancara. Setelah wawancara selesai, permintaan penghapusan data melalui jalur permintaan subjek data terpisah.

        Dengan menyetujui, Anda menyatakan telah membaca dan memahami pemberitahuan ini.
      TEXT

      def consent_text(assessment)
        assessment.language == 'id' ? CONSENT_TEXT_ID : CONSENT_TEXT_EN
      end

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
