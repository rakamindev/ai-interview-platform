# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }

  describe 'GET /api/v1/sessions/:token/candidate (Positive)' do
    it 'returns candidate info with session_status and end_reason for an active session' do
      session = create(:session, :active, assessment: assessment)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = json_response['data'] || json_response
      expect(body['session_id']).to eq(session.id)
      expect(body['role_title']).to eq(assessment.name)
      expect(body['time_limit_min']).to eq(assessment.time_limit_min)
      expect(body['session_status']).to eq('active')
      expect(body['end_reason']).to be_nil
    end

    it 'returns end_reason when session has ended' do
      session = create(:session, :ended, assessment: assessment, end_reason: 'manual_candidate')

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = json_response['data'] || json_response
      expect(body['session_status']).to eq('ended')
      expect(body['end_reason']).to eq('manual_candidate')
    end

    it 'returns end_reason when session ended with error reason' do
      session = create(:session, assessment: assessment, status: 'ended', end_reason: 'error')

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = json_response['data'] || json_response
      expect(body['session_status']).to eq('ended')
      expect(body['end_reason']).to eq('error')
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate (Negative)' do
    it 'returns 404 when invite token does not exist' do
      get '/api/v1/sessions/non_existent_token_12345/candidate'

      expect(response).to have_http_status(:not_found)
      body = json_response
      expect(body['errors'] || body['error']).to be_present
    end
  end

  describe 'Protected session endpoints (Negative - Authentication)' do
    it 'rejects unauthenticated access to show session with 401 unauthorized when tenant is present' do
      session = create(:session, assessment: assessment)

      get "/api/v1/sessions/#{session.id}", headers: {
        'X-Tenant-Scheme' => organization.scheme
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects unauthenticated access to list assessment sessions with 401 when tenant is present' do
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: {
        'X-Tenant-Scheme' => organization.scheme
      }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects requests with missing tenant scheme with 403 forbidden' do
      session = create(:session, assessment: assessment)

      get "/api/v1/sessions/#{session.id}"

      expect(response).to have_http_status(:forbidden)
    end
    it 'rejects invalid / tampered JWT token with 401' do
      session = create(:session, assessment: assessment)

      get "/api/v1/sessions/#{session.id}", headers: {
        'Authorization' => 'Bearer invalid.tampered.token',
        'X-Tenant-Scheme' => organization.scheme
      }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
