# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate Consent API', type: :request do
  let!(:assessment) do
    Assessment.create!(
      tenant_id: 1,
      created_by: 1,
      name: 'Senior Fullstack Engineer',
      time_limit_min: 45
    )
  end

  let!(:session) do
    Session.create!(
      tenant_id: 1,
      assessment_id: assessment.id,
      invite_token: 'valid_candidate_token_123',
      status: 'pending'
    )
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns consent_given false initially' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be false
      expect(body['role_title']).to eq('Senior Fullstack Engineer')
    end

    it 'returns consent_given true after candidate provides consent' do
      session.update!(
        consent_given_at: Time.current,
        consent_version: 'v1.0-uupdp-2022',
        pdp_retention_acknowledged: true
      )

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['consent_given']).to be true
      expect(body['consent_version']).to eq('v1.0-uupdp-2022')
    end
  end

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records candidate explicit consent under UU PDP successfully' do
      post "/api/v1/sessions/#{session.invite_token}/consent", params: {
        pdp_retention_acknowledged: true,
        consent_version: 'v1.0-uupdp-2022'
      }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['status']).to eq('consent_recorded')
      expect(body['consent_given']).to be true

      session.reload
      expect(session.consent_given?).to be true
      expect(session.consent_version).to eq('v1.0-uupdp-2022')
      expect(session.pdp_retention_acknowledged).to be true
    end

    it 'rejects consent request without retention acknowledgement' do
      post "/api/v1/sessions/#{session.invite_token}/consent", params: {
        pdp_retention_acknowledged: false
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      error_message = body.dig('errors', 0, 'message')
      expect(error_message).to include('Data retention and processing acknowledgement is required')
    end

    it 'rejects consent request for ended session' do
      session.update!(status: 'ended')

      post "/api/v1/sessions/#{session.invite_token}/consent", params: {
        pdp_retention_acknowledged: true
      }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      error_message = body.dig('errors', 0, 'message')
      expect(error_message).to eq('Cannot record consent for ended session')
    end

    it 'returns 404 for invalid invite token' do
      post '/api/v1/sessions/non_existent_token/consent', params: {
        pdp_retention_acknowledged: true
      }

      expect(response).to have_http_status(:not_found)
    end
  end
end
