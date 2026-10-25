# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Speed test endpoint (F-13)', type: :request do
  describe 'GET /api/v1/speed_test' do
    it 'returns a fixed-size payload for download measurement' do
      get '/api/v1/speed_test', params: { bytes: 1024 }

      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/octet-stream')
      expect(response.body.bytesize).to eq(1024)
    end

    it 'caps the payload size at 5 MB' do
      get '/api/v1/speed_test', params: { bytes: 100 * 1024 * 1024 }

      expect(response).to have_http_status(:ok)
      expect(response.body.bytesize).to eq(5 * 1024 * 1024)
    end

    it 'returns an empty payload when bytes is not provided' do
      get '/api/v1/speed_test'

      expect(response).to have_http_status(:ok)
      expect(response.body.bytesize).to eq(0)
    end
  end

  describe 'POST /api/v1/speed_test' do
    it 'reports the number of bytes received (upload measurement)' do
      post '/api/v1/speed_test', params: { test: 'x' * 2048 }

      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/json')
      body = JSON.parse(response.body)
      expect(body['received_bytes']).to be > 0
    end
  end
end
