# frozen_string_literal: true

module Api
  module V1
    class SpeedTestsController < ApiController
      # Candidate hardware checks are public endpoints. They do not expose
      # tenant data and must work before candidate authentication exists.
      skip_before_action :require_tenant!

      MAX_UPLOAD_BYTES = 10.megabytes

      # GET /api/v1/speed_test/ping
      def ping
        response.headers["Cache-Control"] = "no-store, no-cache, max-age=0"
        json_response(status: "ok", timestamp: Time.current.iso8601)
      end

      # POST /api/v1/speed_test/upload
      def upload
        content_length = request.content_length.to_i
        return too_large if content_length > MAX_UPLOAD_BYTES

        body = request.body.read.to_s
        bytes = body.bytesize
        return too_large if bytes > MAX_UPLOAD_BYTES

        response.headers["Cache-Control"] = "no-store, no-cache, max-age=0"
        json_response(received_bytes: bytes)
      end

      private

      def too_large
        render json: {
          errors: [{ status: 413, message: "Speed test payload is too large" }]
        }, status: :payload_too_large
      end
    end
  end
end
