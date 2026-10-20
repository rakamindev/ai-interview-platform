# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::SpeedTest', type: :request do
  describe 'POST /api/v1/speed_test' do
    it 'accepts payload and returns bytes received' do
      post '/api/v1/speed_test', params: 'test payload data', headers: { 'CONTENT_TYPE' => 'application/octet-stream' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['received_bytes']).to eq('test payload data'.bytesize)
    end
  end

  describe 'GET /api/v1/speed_test' do
    it 'returns a 512KB payload for local download speed test' do
      get '/api/v1/speed_test'

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to eq('application/octet-stream')
      expect(response.body.bytesize).to eq(512 * 1024)
    end
  end
end
