# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Health', type: :request do
  describe 'GET /api/v1/health' do
    it 'returns ok' do
      get '/api/v1/health'
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['status']).to eq('ok')
    end
  end
end
