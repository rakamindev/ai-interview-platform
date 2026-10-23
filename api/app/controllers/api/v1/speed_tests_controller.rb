# frozen_string_literal: true

module Api
  module V1
    # Throughput probe for the candidate pre-check. The browser measures against
    # this API rather than a third-party CDN because the interview WebSocket
    # terminates on the same host: if this is slow or unreachable, so is the
    # interview. Candidates have no JWT or tenant at this point.
    class SpeedTestsController < ApiController
      skip_before_action :require_tenant!

      # Exactly what the web pre-check requests; anything larger only helps abuse.
      MAX_DOWNLOAD_BYTES     = 256.kilobytes
      DEFAULT_DOWNLOAD_BYTES = MAX_DOWNLOAD_BYTES
      MAX_UPLOAD_BYTES       = 2.megabytes

      # GET /api/v1/speed_test?bytes=N
      # Random bytes, because zeros would be gzipped to nothing by any proxy on
      # the path and the browser would measure a transfer that never happened.
      def show
        response.headers['Cache-Control'] = 'no-store'
        send_data SecureRandom.random_bytes(download_bytes),
                  type: 'application/octet-stream',
                  disposition: 'inline'
      end

      # POST /api/v1/speed_test
      # Puma buffers the full body before dispatch, so the client's timer covers
      # the whole upload even though the body is never read here.
      def create
        received = request.content_length.to_i
        return json_error('Payload too large', :payload_too_large) if received > MAX_UPLOAD_BYTES

        json_response({ received_bytes: received })
      end

      private

      def download_bytes
        requested = Integer(query_params[:bytes], exception: false)
        return DEFAULT_DOWNLOAD_BYTES if requested.nil? || requested <= 0

        [requested, MAX_DOWNLOAD_BYTES].min
      end
    end
  end
end
