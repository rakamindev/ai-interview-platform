# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SpeedTest', type: :request do
  describe 'POST /api/v1/speed_test' do
    it 'reports the number of bytes received' do
      post '/api/v1/speed_test', params: 'x' * 2048, headers: { 'Content-Type' => 'application/octet-stream' }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq('received_bytes' => 2048)
    end

    it 'reports zero when no payload is sent' do
      post '/api/v1/speed_test'

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq('received_bytes' => 0)
    end

    it 'is reachable without a tenant or JWT' do
      post '/api/v1/speed_test', params: 'x' * 10, headers: { 'Content-Type' => 'application/octet-stream' }

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'GET /api/v1/speed_test/download' do
    it 'returns a 1 MB payload by default' do
      get '/api/v1/speed_test/download'

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq('application/octet-stream')
      expect(response.body.bytesize).to eq(1.megabyte)
    end

    it 'returns the requested number of bytes' do
      get '/api/v1/speed_test/download', params: { bytes: 4096 }

      expect(response.body.bytesize).to eq(4096)
    end

    it 'caps the payload at 2 MB' do
      get '/api/v1/speed_test/download', params: { bytes: 50.megabytes }

      expect(response.body.bytesize).to eq(2.megabytes)
    end

    it 'falls back to the default for invalid sizes' do
      get '/api/v1/speed_test/download', params: { bytes: 'abc' }

      expect(response.body.bytesize).to eq(1.megabyte)
    end

    it 'prevents caching so every measurement is fresh' do
      get '/api/v1/speed_test/download', params: { bytes: 16 }

      expect(response.headers['Cache-Control']).to eq('no-store')
    end
  end
end
