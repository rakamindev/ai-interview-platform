# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions API Characterization', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin) }
  let!(:assessment) { create(:assessment, tenant_id: org.id, created_by: admin.id) }
  let!(:session_record) { create(:session, assessment: assessment, tenant_id: org.id, status: 'active') }

  let(:headers) { authenticated_headers(admin, scheme: org.scheme) }

  describe 'POST /api/v1/sessions/:id/end_session' do
    it 'ends an active session with valid reason' do
      post "/api/v1/sessions/#{session_record.id}/end_session",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(session_record.reload.status).to eq('ended')
      expect(session_record.end_reason).to eq('manual_assessor')
    end

    it 'returns 422 if session is already ended' do
      session_record.update!(status: 'ended')

      post "/api/v1/sessions/#{session_record.id}/end_session",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body[:errors].first[:message]).to eq('Session is already ended')
    end
  end

  describe 'Candidate Endpoints (Unauthenticated)' do
    it 'GET /api/v1/sessions/:token/candidate returns candidate info without JWT' do
      get "/api/v1/sessions/#{session_record.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(json_body[:session_id]).to eq(session_record.id)
      expect(json_body[:role_title]).to eq(assessment.name)
      expect(json_body[:time_limit_min]).to eq(assessment.time_limit_min)
      expect(json_body[:session_status]).to eq(session_record.status)
    end

    it 'returns 404 for invalid invite token' do
      get '/api/v1/sessions/non-existent-token/candidate'
      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Invalid or expired invite token')
    end

    it 'characterizes GAP P1-5: POST /api/v1/sessions/:token/audio_complete force-ends session without checking coverage' do
      post "/api/v1/sessions/#{session_record.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(json_body[:ended]).to be true
      expect(session_record.reload.status).to eq('ended')
      expect(session_record.end_reason).to eq('all_covered')
    end

    it 'redirects GET /interview/:token to the web frontend URL' do
      get "/interview/#{session_record.invite_token}"

      expect(response).to have_http_status(:redirect)
      expect(response).to redirect_to("http://localhost:5173/interview/#{session_record.invite_token}")
    end
  end
end
