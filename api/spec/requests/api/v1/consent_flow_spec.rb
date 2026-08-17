# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate consent flow', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, tenant_id: organization.id, assessment: assessment) }

  before do
    headers = { 'X-Tenant-Scheme' => organization.scheme }
    @headers = headers
  end

  def tenant_headers
    @headers
  end

  describe 'GET /sessions/:token/candidate' do
    it 'reports consent_required + has_consent (AC-B2)' do
      get "/api/v1/sessions/#{session.invite_token}/candidate", headers: tenant_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_required']).to be(true)
      expect(body['consent_version']).to eq(Consent::CURRENT_VERSION)
      expect(body['has_consent']).to be(false)
    end

    it 'returns 404 for an invalid token' do
      get '/api/v1/sessions/not-a-real-token/candidate', headers: tenant_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /sessions/:token/consent' do
    it 'grants consent with 201 (AC-B1)' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { version: Consent::CURRENT_VERSION }, headers: tenant_headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('granted')
      expect(body['consent']['version']).to eq(Consent::CURRENT_VERSION)
      expect(session.reload.consent_granted?).to be(true)
    end

    it 'is idempotent — repeat grant returns 200 with no duplicate row (AC-B1, AC-B2)' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { version: Consent::CURRENT_VERSION }, headers: tenant_headers
      expect(response).to have_http_status(:created)

      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { version: Consent::CURRENT_VERSION }, headers: tenant_headers
      expect(response).to have_http_status(:ok)

      expect(Consent.where(session_id: session.id).count).to eq(1)
    end

    it 'rejects a mismatched disclosure version' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { version: '2020-01-01' }, headers: tenant_headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.consent_granted?).to be(false)
    end

    it 'requires a version param' do
      post "/api/v1/sessions/#{session.invite_token}/consent", params: {}, headers: tenant_headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'returns 404 for an invalid token' do
      post '/api/v1/sessions/bad-token/consent', params: { version: Consent::CURRENT_VERSION }, headers: tenant_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /sessions/:token/consent/revoke' do
    it 'revokes a granted consent' do
      create(:consent, session: session, tenant_id: organization.id)

      post "/api/v1/sessions/#{session.invite_token}/consent/revoke", headers: tenant_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('revoked')
      expect(session.reload.consent_granted?).to be(false)
    end

    it 'returns 404 when no consent exists' do
      post "/api/v1/sessions/#{session.invite_token}/consent/revoke", headers: tenant_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /sessions/:token/transcript' do
    it 'returns 403 without granted consent (AC-B1)' do
      get "/api/v1/sessions/#{session.invite_token}/candidate/transcript", headers: tenant_headers
      expect(response).to have_http_status(:forbidden)
    end

    it 'returns the candidate transcript while consent is granted' do
      create(:consent, session: session, tenant_id: organization.id)
      create(:transcript_turn, session: session, speaker: 'ai', text: 'Tell me about React')
      create(:transcript_turn, session: session, speaker: 'candidate', text: 'I build UIs with hooks')

      get "/api/v1/sessions/#{session.invite_token}/candidate/transcript", headers: tenant_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['total']).to eq(2)
      expect(body['turns'].map { |t| t['text'] }).to include('I build UIs with hooks')
    end

    it 'returns 403 after consent is revoked' do
      create(:consent, session: session, tenant_id: organization.id, status: 'revoked', granted_at: 1.hour.ago, revoked_at: 1.minute.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate/transcript", headers: tenant_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'POST /sessions/:token/audio_complete' do
    before do
      allow(PortfolioGeneratorWorker).to receive(:perform_async)
    end

    it 'returns 403 without granted consent (AC-B1)' do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete", headers: tenant_headers
      expect(response).to have_http_status(:forbidden)
      expect(session.reload).not_to be_ended
    end

    it 'ends the session when consent is granted' do
      create(:consent, session: session, tenant_id: organization.id)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete", headers: tenant_headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['ended']).to be(true)
      expect(session.reload).to be_ended
    end
  end

  describe 'DELETE /sessions/:token/data' do
    it 'schedules deletion and returns 202 (AC-B3)' do
      expect(CandidateDataDeletionJob).to receive(:perform_async).with(session.id)

      delete "/api/v1/sessions/#{session.invite_token}/data", headers: tenant_headers

      expect(response).to have_http_status(:accepted)
    end

    it 'returns 404 for an invalid token' do
      delete '/api/v1/sessions/bad-token/data', headers: tenant_headers
      expect(response).to have_http_status(:not_found)
    end
  end
end