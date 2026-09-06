# frozen_string_literal: true

module Api
  module V1
    class CandidatesController < ActionController::API
      before_action :load_session_by_token

      # GET /api/v1/candidate/:token
      def show
        consent = @session.candidate_consent
        org_name = Organization.find_by(id: @session.tenant_id)&.name || 'Organization'

        render json: {
          organization_name:   org_name,
          assessment_name:     @session.assessment&.name,
          consent_required:    true,
          has_consent:         consent&.granted? || false,
          disclosure_version:  CandidateConsent::DISCLOSURE_VERSION,
          data_collected: [
            'Rekaman audio sesi interview',
            'Transkrip percakapan berbasis teks',
            'Penilaian skill berbasis AI (tidak final)',
            'Waktu dan durasi sesi'
          ],
          retention_period:   '1 tahun sejak tanggal interview',
          candidate_rights: [
            'Mengakses data yang telah dikumpulkan tentang Anda',
            'Meminta penghapusan data Anda dari sistem',
            'Menolak untuk melanjutkan interview kapan saja',
            'Mendapatkan salinan data Anda dalam format yang dapat dibaca'
          ],
          contact_email: 'privacy@rakamin.com'
        }
      end

      # POST /api/v1/candidate/:token/consent
      def grant_consent
        consent = @session.candidate_consent

        if consent&.granted?
          return render json: {
            status:  'granted',
            message: 'Persetujuan sudah diberikan sebelumnya.'
          }, status: :ok
        end

        consent ||= @session.build_candidate_consent(
          tenant_id:          @session.tenant_id,
          disclosure_version: CandidateConsent::DISCLOSURE_VERSION
        )

        consent.assign_attributes(
          status:     'granted',
          granted_at: Time.current,
          ip_address: request.remote_ip,
          user_agent: request.user_agent&.first(500)
        )
        consent.save!

        render json: {
          status:  'granted',
          message: 'Persetujuan berhasil dicatat. Interview dapat dimulai.'
        }, status: :created
      end

      # GET /api/v1/candidate/:token/transcript
      def transcript
        consent = @session.candidate_consent
        unless consent&.granted?
          return render json: {
            error: 'Akses transcript membutuhkan persetujuan data yang valid. Silakan berikan persetujuan terlebih dahulu.'
          }, status: :forbidden
        end

        render json: {
          session_id:  @session.id,
          transcript:  @session.transcript_turns.order(:turn_number).map { |t|
            {
              speaker:     t.speaker,
              text:        t.text,
              turn_number: t.turn_number,
              timestamp:   t.created_at&.iso8601
            }
          }
        }
      end

      private

      def load_session_by_token
        @session = Session.unscoped.find_by(invite_token: params[:token])
        unless @session
          render json: { error: 'Link undangan tidak valid atau sudah kedaluwarsa.' }, status: :not_found
        end
      end
    end
  end
end
