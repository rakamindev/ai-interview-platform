# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Health', type: :request do
  describe 'GET /health' do
    it 'returns 200 with an ok status' do
      get '/health'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq('status' => 'ok')
    end
  end

  describe 'GET /api/v1/health' do
    it 'returns 200 with an ok status' do
      get '/api/v1/health'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq('status' => 'ok')
    end
  end
end
