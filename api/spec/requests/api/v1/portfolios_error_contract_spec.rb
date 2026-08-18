# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios Error Sanitization Contract', type: :request do
  let!(:org) { Organization.create!(id: 140, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:user) { User.create!(email: 'assessor_err@example.com', password: 'password123', role: 'admin') }
  let(:token) { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }

  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Error Contract Assessment', created_by: user.id, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 601, candidate_name: 'Candidate Err', status: 'ended') }
  let!(:portfolio) do
    session.create_portfolio!(
      candidate_id: session.candidate_id,
      generation_status: 'failed',
      generation_error: 'INTERNAL_SECRET_MARKER: Faraday::TimeoutError at https://generativelanguage.googleapis.com with key AIzaSyDUMMY'
    )
  end

  describe 'GET /api/v1/sessions/:id/portfolio for failed generation (ERR-AC-01 through ERR-AC-03)' do
    it '26, 27, 28. Returns stable error_code, user-friendly message, and strips sensitive exception markers' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body['status']).to eq('failed')
      expect(body['error']).to eq('Evaluation generation encountered an issue. Please retry.')
      expect(body['error_code']).to eq('EVALUATION_FAILED')

      # Proves raw exception markers, URLs, and API keys are NOT leaked
      expect(response.body).not_to include('INTERNAL_SECRET_MARKER')
      expect(response.body).not_to include('Faraday::TimeoutError')
      expect(response.body).not_to include('generativelanguage.googleapis.com')
      expect(response.body).not_to include('AIzaSyDUMMY')
    end
  end
end
