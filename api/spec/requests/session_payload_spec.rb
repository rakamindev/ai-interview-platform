# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session payload contract', type: :request do
  let(:org)        { create_organization }
  let(:user)       { create_user(tenant: org) }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)    { build_session(tenant: org, assessment: assessment) }
  let(:token)      { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }

  describe 'GET /api/v1/sessions/:id (assessor view)' do
    it 'does not leak the raw invite_token' do
      get "/api/v1/sessions/#{session.id}", headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['session']).not_to have_key('invite_token')
    end

    it 'exposes invite_url pointing at the web host, not the API port' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('WEB_BASE_URL', anything).and_return('http://web.example.test')

      get "/api/v1/sessions/#{session.id}", headers: { 'Authorization' => "Bearer #{token}" }

      body = JSON.parse(response.body)
      expect(body['session']['invite_url']).to start_with('http://web.example.test/interview/')
      expect(body['session']['invite_url']).not_to include('3001')
    end
  end
end
