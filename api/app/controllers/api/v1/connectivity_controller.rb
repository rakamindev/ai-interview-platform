# frozen_string_literal: true

module Api
  module V1
    # Connectivity probes for the candidate readiness check (web: utils/readiness.ts).
    #
    # Candidates run these before they hold a JWT, so there is no auth and no
    # tenant. Measuring against our own API instead of third-party echo services
    # (httpbin, postman-echo, public CDNs) keeps the candidate's IP and traffic
    # in-house (UU PDP) and measures the network path the interview audio uses.
    class ConnectivityController < ApiController
      skip_before_action :require_tenant!
      before_action :disable_caching

      DOWNLOAD_BYTES   = 256 * 1024
      MAX_UPLOAD_BYTES = 1024 * 1024
      READ_CHUNK_BYTES = 64 * 1024
      # Random bytes so no proxy can compress the payload and inflate the measured speed.
      DOWNLOAD_PAYLOAD = SecureRandom.random_bytes(DOWNLOAD_BYTES).freeze

      # GET /api/v1/connectivity/ping
      def ping
        head :no_content
      end

      # GET /api/v1/connectivity/download
      def download
        send_data DOWNLOAD_PAYLOAD, type: 'application/octet-stream', disposition: 'inline'
      end

      # POST /api/v1/connectivity/upload  (legacy alias: POST /api/v1/speed_test)
      #
      # Reports the bytes actually received. The declared Content-Length is only
      # used to reject obviously oversized uploads early; it is never echoed back.
      def upload
        return payload_too_large if request.content_length.to_i > MAX_UPLOAD_BYTES

        received = read_capped(request.body)
        return payload_too_large if received > MAX_UPLOAD_BYTES

        json_response(received_bytes: received)
      end

      private

      def disable_caching
        response.headers['Cache-Control'] = 'no-store'
      end

      # Reads at most one chunk past the cap, so an oversized body is detected
      # without buffering all of it.
      def read_capped(io)
        io.rewind if io.respond_to?(:rewind)
        total = 0
        while (chunk = io.read(READ_CHUNK_BYTES))
          total += chunk.bytesize
          break if total > MAX_UPLOAD_BYTES
        end
        total
      end

      def payload_too_large
        json_error("Upload exceeds #{MAX_UPLOAD_BYTES} bytes", :payload_too_large)
      end
    end
  end
end
