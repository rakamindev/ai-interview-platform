# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SpeedTests', type: :request do
  describe 'GET /api/v1/speed_test' do
    it 'returns exactly the requested number of bytes without a tenant or JWT' do
      get '/api/v1/speed_test', params: { bytes: 4096 }

      expect(response).to have_http_status(:ok)
      expect(response.body.bytesize).to eq(4096)
      expect(response.media_type).to eq('application/octet-stream')
    end

    it 'forbids caching so every run measures a real transfer' do
      get '/api/v1/speed_test', params: { bytes: 1024 }

      expect(response.headers['Cache-Control']).to include('no-store')
    end

    it 'serves random bytes so compression on the path cannot shrink the payload' do
      get '/api/v1/speed_test', params: { bytes: 4096 }

      expect(response.body.bytes.uniq.size).to be > 1
    end

    it 'falls back to the default size when bytes is missing or invalid' do
      get '/api/v1/speed_test', params: { bytes: 'abc' }

      expect(response.body.bytesize).to eq(Api::V1::SpeedTestsController::DEFAULT_DOWNLOAD_BYTES)
    end

    it 'caps the payload so the endpoint cannot be used to pull unbounded data' do
      get '/api/v1/speed_test', params: { bytes: 50.megabytes }

      expect(response.body.bytesize).to eq(Api::V1::SpeedTestsController::MAX_DOWNLOAD_BYTES)
    end
  end

  describe 'POST /api/v1/speed_test' do
    it 'reports how many bytes it received' do
      post '/api/v1/speed_test',
           params: 'x' * 2048,
           headers: { 'CONTENT_TYPE' => 'application/octet-stream' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['received_bytes']).to eq(2048)
    end

    it 'rejects payloads above the upload cap' do
      oversized = Api::V1::SpeedTestsController::MAX_UPLOAD_BYTES + 1

      post '/api/v1/speed_test',
           params: 'x' * oversized,
           headers: { 'CONTENT_TYPE' => 'application/octet-stream' }

      expect(response).to have_http_status(:payload_too_large)
    end
  end
end
