# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Consent API', type: :request do
  let!(:assessment) do
    Current.tenant_id = 1
    Assessment.create!(
      name: 'Frontend Engineer Assessment',
      time_limit_min: 30,
      language: 'en',
      created_by: 1
    )
  end

  let!(:session) do
    Current.tenant_id = 1
    Session.create!(
      assessment: assessment,
      candidate_name: 'Jane Candidate',
      status: 'pending'
    )
  end

  before do
    Current.tenant_id = 1
  end

  after do
    Current.tenant_id = nil
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'grants consent and returns consent metadata' do
      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be(true)
      expect(body['consent_given_at']).to be_present

      expect(session.reload.consent_given?).to be(true)
    end

    it 'is idempotent and preserves initial consent timestamp' do
      initial_time = Time.zone.parse('2026-09-05 08:00:00')
      session.update!(consent_given_at: initial_time)

      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be(true)
      expect(session.reload.consent_given_at).to eq(initial_time)
    end

    it 'returns 404 for an invalid invite token' do
      post '/api/v1/sessions/nonexistent-token/consent'

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body.dig('errors', 0, 'message')).to eq('Invalid or expired invite token')
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns consent_given as false before consent is granted' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be(false)
      expect(body['consent_given_at']).to be_nil
    end

    it 'returns consent_given as true after consent is granted' do
      session.grant_consent!

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be(true)
      expect(body['consent_given_at']).to be_present
    end
  end
end
