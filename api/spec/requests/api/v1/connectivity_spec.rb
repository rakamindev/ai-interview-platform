# frozen_string_literal: true

require 'rails_helper'

# Connectivity probes used by the candidate readiness check. They must work
# before the candidate has a JWT or a tenant context, never be cached, and
# never trust client-supplied sizes.
RSpec.describe 'Connectivity probes', type: :request do
  let(:max_upload) { Api::V1::ConnectivityController::MAX_UPLOAD_BYTES }

  describe 'GET /api/v1/connectivity/ping' do
    it 'answers without auth or tenant and is never cached' do
      get '/api/v1/connectivity/ping'

      expect(response).to have_http_status(:no_content)
      expect(response.headers['Cache-Control']).to include('no-store')
    end
  end

  describe 'GET /api/v1/connectivity/download' do
    it 'returns a fixed-size, uncacheable binary payload' do
      get '/api/v1/connectivity/download'

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq('application/octet-stream')
      expect(response.body.bytesize).to eq(Api::V1::ConnectivityController::DOWNLOAD_BYTES)
      expect(response.headers['Cache-Control']).to include('no-store')
    end
  end

  describe 'POST /api/v1/connectivity/upload' do
    def upload(bytes, path: '/api/v1/connectivity/upload')
      post path, params: bytes, headers: { 'CONTENT_TYPE' => 'application/octet-stream' }
    end

    it 'reports the bytes actually received' do
      upload('a' * 4_096)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['received_bytes']).to eq(4_096)
    end

    it 'accepts a payload exactly at the cap' do
      upload('a' * max_upload)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['received_bytes']).to eq(max_upload)
    end

    it 'rejects a payload over the cap with 413 instead of accepting anything' do
      upload('a' * (max_upload + 1))

      expect(response).to have_http_status(:payload_too_large)
      expect(response.parsed_body.dig('errors', 0, 'status')).to eq(413)
    end

    it 'ignores a lying Content-Length header and counts the real body' do
      post '/api/v1/connectivity/upload',
           params: 'a' * 10,
           headers: { 'CONTENT_TYPE' => 'application/octet-stream', 'CONTENT_LENGTH' => '999999' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['received_bytes']).to eq(10)
    end

    it 'keeps the legacy /speed_test path working with the same safe behaviour' do
      upload('a' * (max_upload + 1), path: '/api/v1/speed_test')

      expect(response).to have_http_status(:payload_too_large)
    end
  end
end
