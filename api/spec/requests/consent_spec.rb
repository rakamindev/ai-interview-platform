# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate consent (UU PDP)', type: :request do
  let(:org)      { create_organization }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)  { build_session(tenant: org, assessment: assessment) }

  describe 'GET /api/v1/sessions/:token/consent' do
    it 'returns the policy disclosure with a valid token' do
      get "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['policy_version']).to eq(ConsentPolicy::POLICY_VERSION)
      expect(body['consent_status']).to eq('pending')
      expect(body['policy']['data_collected']).to be_an(Array).and be_present
      expect(body['policy']['rights']).to be_an(Array).and be_present
    end

    it 'localizes content by assessment language' do
      assessment.update!(language: 'id')
      get "/api/v1/sessions/#{session.invite_token}/consent"

      body = JSON.parse(response.body)
      expect(body['language']).to eq('id')
    end

    it 'returns 404 for an unknown token' do
      get '/api/v1/sessions/nope/consent'
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records acceptance' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'accepted' } }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent']['status']).to eq('accepted')
      expect(body['consent']['accepted_at']).to be_present
      expect(session.reload.consent_given?).to be true
    end

    it 'records refusal' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'declined' } }

      expect(response).to have_http_status(:ok)
      expect(session.reload.consent_given?).to be false
      expect(session.reload.candidate_consent.declined_at).to be_present
    end

    it 'captures IP and user agent for the audit trail' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'accepted' } },
           headers: { 'User-Agent' => 'RSpec-Test/1.0' }

      consent = session.reload.candidate_consent
      expect(consent.consent_ip).to be_present
      expect(consent.consent_user_agent).to eq('RSpec-Test/1.0')
    end

    it 'is idempotent — re-submitting keeps a single record' do
      2.times do
        post "/api/v1/sessions/#{session.invite_token}/consent",
             params: { consent: { status: 'accepted' } }
      end

      expect(CandidateConsent.where(session_id: session.id).count).to eq(1)
      expect(response).to have_http_status(:ok)
    end

    it 'allows changing from declined to accepted' do
      post "/api/v1/sessions/#{session.invite_token}/consent", params: { consent: { status: 'declined' } }
      post "/api/v1/sessions/#{session.invite_token}/consent", params: { consent: { status: 'accepted' } }

      consent = session.reload.candidate_consent
      expect(consent.status).to eq('accepted')
      expect(consent.accepted_at).to be_present
      expect(consent.declined_at).to be_nil
    end

    it 'rejects an invalid status' do
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'maybe' } }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects consent after the session has ended' do
      session.update!(status: 'ended', end_reason: 'all_covered')
      post "/api/v1/sessions/#{session.invite_token}/consent",
           params: { consent: { status: 'accepted' } }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.consent_given?).to be false
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'surfaces consent requirements to the candidate UI' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      body = JSON.parse(response.body)
      expect(body['consent_required']).to be true
      expect(body['consent_status']).to eq('pending')
    end

    it 'reports accepted consent once given' do
      create_consent(session: session, status: 'accepted')
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(JSON.parse(response.body)['consent_status']).to eq('accepted')
    end
  end
end
