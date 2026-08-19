# frozen_string_literal: true

module Api
  module V1
    class InterviewRecordingsController < ApiController
      authorize_auth_token! :assessor, except: :create_candidate

      def create
        create_for_session(Session.where(tenant_id: current_tenant_id).find(params[:session_id]))
      rescue ActiveRecord::RecordNotFound
        json_error('Session not found', :not_found)
      end

      # Candidate-only upload capability; invite token never grants playback.
      def create_candidate
        create_for_session(Session.find_by!(invite_token: params[:token]))
      rescue ActiveRecord::RecordNotFound
        json_error('Session not found', :not_found)
      end

      def playback
        recording = InterviewRecording.joins(:session)
                                     .where(sessions: { tenant_id: current_tenant_id, id: params[:session_id] })
                                     .first!
        return json_error('Recording has expired', :gone) unless recording.available?

        json_response(playback_url: InterviewRecordings::Storage.new.playback_url(key: recording.object_key))
      rescue ActiveRecord::RecordNotFound
        json_error('Recording not found', :not_found)
      end

      private

      def create_for_session(session)
        return json_error('Recording already exists', :unprocessable_entity) if session.interview_recording

        recording = session.create_interview_recording!(recording_attributes)
        url = InterviewRecordings::Storage.new.upload_url(key: recording.object_key, content_type: recording.content_type)
        json_response({ recording: recording_json(recording), upload_url: url }, :created)
      end

      def recording_attributes
        params.require(:recording).permit(:content_type, :byte_size, :duration_ms, :checksum)
              .merge(
                object_key: "recordings/#{recording_scope}/#{SecureRandom.uuid}",
                captured_at: Time.current,
                expires_at: InterviewRecording::RETENTION_DAYS.days.from_now
              )
      end

      def recording_scope
        params[:session_id] || params[:token]
      end

      def recording_json(recording)
        recording.slice(:id, :session_id, :content_type, :byte_size, :duration_ms, :captured_at, :expires_at)
      end
    end
  end
end
