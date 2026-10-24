# frozen_string_literal: true

module Api
  module V1
    # Candidate pre-flight connectivity checks. Intentionally unauthenticated
    # and tenant-free: the web pre-flight screen measures the candidate's
    # connection to this API before the interview starts.
    class SpeedTestController < ApiController
      skip_before_action :require_tenant!

      DEFAULT_DOWNLOAD_BYTES = 1.megabyte
      MAX_DOWNLOAD_BYTES     = 2.megabytes

      # POST /api/v1/speed_test
      # Accepts any payload, discards it, and reports how many bytes arrived.
      def upload
        json_response(received_bytes: request.content_length.to_i)
      end

      # GET /api/v1/speed_test/download?bytes=N
      # Returns N bytes (default 1 MB, capped at 2 MB) so the client can
      # measure download throughput against this API origin.
      def download
        response.headers['Cache-Control'] = 'no-store'
        send_data("\0" * download_size, type: 'application/octet-stream', disposition: 'inline')
      end

      private

      def download_size
        requested = params[:bytes].to_s.to_i
        requested = DEFAULT_DOWNLOAD_BYTES unless requested.positive?
        [requested, MAX_DOWNLOAD_BYTES].min
      end
    end
  end
end
