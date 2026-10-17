# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session consent endpoints', type: :request do
  let(:tenant_id) { 1 }
  let(:assessment) { Current.using(tenant_id: tenant_id) { create(:assessment) } }
  let(:session) { Current.using(tenant_id: tenant_id) { create(:session, assessment: assessment) } }
  let(:token) { session.invite_token }

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'includes consent metadata' do
      get "/api/v1/sessions/#{token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_required']).to be true
      expect(body['consent_status']).to eq('none')
      expect(body['consent_version']).to eq(Session::CONSENT_VERSION)
      expect(body['consent_text']).to include('WHAT WE COLLECT')
    end

    it 'returns 404 for unknown token' do
      get '/api/v1/sessions/does-not-exist/candidate'

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records explicit consent' do
      post "/api/v1/sessions/#{token}/consent",
           params: { accepted: true, consent_version: 'v1' }, as: :json

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_status']).to eq('given')

      session.reload
      expect(session.consent_given?).to be true
      expect(session.consented_at).to be_present
      expect(session.consent_text_hash).to be_present
    end

    it 'is idempotent on repeated grant' do
      post "/api/v1/sessions/#{token}/consent",
           params: { accepted: true, consent_version: 'v1' }, as: :json
      first_consented_at = session.reload.consented_at

      post "/api/v1/sessions/#{token}/consent",
           params: { accepted: true, consent_version: 'v1' }, as: :json

      expect(response).to have_http_status(:ok)
      expect(session.reload.consented_at).to eq(first_consented_at)
    end

    it 'rejects an out-of-date consent version' do
      post "/api/v1/sessions/#{token}/consent",
           params: { accepted: true, consent_version: 'v0' }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors'].first['message']).to include('Consent version out of date')
    end

    it 'returns 409 for an ended session' do
      session.update!(status: 'ended', end_reason: 'manual_assessor')

      post "/api/v1/sessions/#{token}/consent",
           params: { accepted: true, consent_version: 'v1' }, as: :json

      expect(response).to have_http_status(:conflict)
    end

    it 'returns 404 for unknown token' do
      post '/api/v1/sessions/does-not-exist/consent',
           params: { accepted: true, consent_version: 'v1' }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/consent/revoke' do
    it 'withdraws consent before the interview' do
      session.grant_consent!(version: 'v1', consent_text: 'notice')

      post "/api/v1/sessions/#{token}/consent/revoke"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_status']).to eq('revoked')
      expect(session.reload.consent_revoked_at).to be_present
    end

    it 'is idempotent on repeated revoke' do
      session.grant_consent!(version: 'v1', consent_text: 'notice')

      2.times { post "/api/v1/sessions/#{token}/consent/revoke" }

      expect(response).to have_http_status(:ok)
      expect(session.reload.consent_status).to eq('revoked')
    end

    it 'returns 409 for an ended session' do
      session.update!(status: 'ended', end_reason: 'manual_assessor')

      post "/api/v1/sessions/#{token}/consent/revoke"

      expect(response).to have_http_status(:conflict)
    end
  end
end