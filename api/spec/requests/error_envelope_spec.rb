# frozen_string_literal: true

require 'rails_helper'

# F-26 contract test: every HTTP error response must use the unified envelope
# { error: { code, message } } so the frontend interceptor can normalize a
# single error contract. Seeded-fault: reverting any backend error renderer to
# the legacy { errors: [...] } shape (or the singular { error: 'string' } 429
# shape) makes one of these examples fail.
RSpec.describe 'Unified error envelope (F-26)', type: :request do
  let(:org) do
    Organization.create!(
      name: 'Envelope Corp',
      scheme: 'envelope-test',
      identifier: 'envelope-test',
      host: 'envelope.test.local'
    )
  end

  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme }) }

  let(:json_body) { JSON.parse(response.body) }

  describe 'shape contract' do
    it 'every error response is exactly { error: { code, message } }' do
      get '/api/v1/assessments/999999', headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:not_found)
      expect(json_body.keys).to contain_exactly('error')
      expect(json_body['error'].keys).to contain_exactly('code', 'message')
      expect(json_body.dig('error', 'code')).to eq('not_found')
      expect(json_body.dig('error', 'message')).to be_a(String)
    end
  end

  describe '401/403 unauthenticated (missing / invalid token)' do
    it 'missing token' do
      get '/api/v1/assessments'

      # require_tenant! (ApplicationController before_action) runs before the
      # auth check, so an unauthenticated request is rejected as tenant_not_found.
      # The contract tested here is the SHAPE — any status still uses the
      # unified { error: { code, message } } envelope.
      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig('error', 'code')).to eq('tenant_not_found')
      expect(json_body.dig('error', 'message')).to be_a(String)
    end

    it 'invalid token' do
      get '/api/v1/assessments', headers: { 'Authorization' => 'Bearer not.a.real.token' }

      expect(response).to have_http_status(:forbidden)
      expect(json_body.dig('error', 'code')).to eq('tenant_not_found')
    end
  end

  describe '404 not found' do
    it 'unknown resource id returns code not_found' do
      get '/api/v1/assessments/999999', headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:not_found)
      expect(json_body.dig('error', 'code')).to eq('not_found')
    end
  end

  describe '422 invalid_invitation' do
    it 'signup without an administrator invitation uses the unified envelope' do
      post '/api/v1/auth/signup',
           params: { email: 'envelope@test.corp', password: 'Password123!' }.to_json,
           headers: { 'Content-Type' => 'application/json' }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig('error', 'code')).to eq('invalid_invitation')
    end
  end

  describe '429 rate_limited (Rack::Attack)' do
    it 'throttled responder emits the unified envelope' do
      status, _headers, body = Rack::Attack.throttled_responder.call(nil)

      expect(status).to eq(429)
      payload = JSON.parse(body.first)
      expect(payload.dig('error', 'code')).to eq('rate_limited')
      expect(payload.dig('error', 'message')).to include('Too many requests')
    end
  end
end
