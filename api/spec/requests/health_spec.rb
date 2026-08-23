# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health & Speed Test', type: :request do
  describe 'GET /health' do
    it 'returns ok status' do
      get '/health'

      expect(response).to have_http_status(:ok)
      expect(json_body['status']).to eq('ok')
    end

    it 'works without tenant' do
      get '/health'

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'GET /api/v1/health' do
    it 'returns ok status' do
      get '/api/v1/health'

      expect(response).to have_http_status(:ok)
      expect(json_body['status']).to eq('ok')
    end
  end

  describe 'POST /api/v1/speed_test' do
    it 'returns received bytes' do
      post '/api/v1/speed_test', params: { test: 'data' }

      expect(response).to have_http_status(:ok)
      expect(json_body['received_bytes']).to be >= 0
    end

    it 'works with empty body' do
      post '/api/v1/speed_test', params: {}

      expect(response).to have_http_status(:ok)
      expect(json_body['received_bytes']).to eq(0)
    end
  end
end