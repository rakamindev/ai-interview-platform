# frozen_string_literal: true

require 'rails_helper'

# Smoke test proving the harness works end to end:
# routing, tenant middleware, JWT auth and the test database.
RSpec.describe 'API smoke', type: :request do
  describe 'GET /api/v1/health' do
    it 'returns ok without authentication' do
      get '/api/v1/health'

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq('status' => 'ok')
    end
  end

  describe 'GET /api/v1/assessments' do
    it 'lists assessments for an assessor in the current tenant' do
      get '/api/v1/assessments', headers: auth_headers(role: 'admin')

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to include('assessments' => [])
    end

    it 'rejects a candidate token (role student)' do
      get '/api/v1/assessments', headers: auth_headers(role: 'student')

      expect(response).to have_http_status(:forbidden)
    end

    it 'rejects a token signed with a different secret' do
      forged = JWT.encode({ user_id: 1, role: 'admin', scheme: AuthHelpers::TEST_SCHEME,
                            exp: 1.hour.from_now.to_i }, 'not-the-real-secret', 'HS256')
      test_organization

      get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{forged}" }

      expect(response).to have_http_status(:unauthorized)
      expect(response.body).to include('Signature verification failed')
      expect(response.body).not_to include('assessments')
    end
  end
end
