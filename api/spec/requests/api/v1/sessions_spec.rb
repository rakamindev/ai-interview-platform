# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id, status: 'pending') }
  let(:admin_token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{admin_token}" } }

  before do
    org
  end

  describe 'GET /api/v1/sessions/:id' do
    it 'returns session details with tenant context' do
      get "/api/v1/sessions/#{session_record.id}", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['session']['id']).to eq(session_record.id)
      expect(json['session']['status']).to eq('pending')
      expect(json['session']['assessment']['name']).to eq(assessment.name)
    end
  end

  describe 'POST /api/v1/sessions/:id/end_session' do
    it 'ends an active session with valid reason' do
      session_record.update!(status: 'active', started_at: 10.minutes.ago)

      post "/api/v1/sessions/#{session_record.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(session_record.reload.status).to eq('ended')
      expect(session_record.end_reason).to eq('manual_assessor')
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns public candidate metadata without JWT' do
      get "/api/v1/sessions/#{session_record.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['session_id']).to eq(session_record.id)
      expect(json['role_title']).to eq(assessment.name)
      expect(json['time_limit_min']).to eq(assessment.time_limit_min)
    end
  end

  describe 'POST /api/v1/sessions/:token/audio_complete' do
    it 'marks session ended and queues portfolio generation' do
      session_record.update!(status: 'active', started_at: 5.minutes.ago)

      post "/api/v1/sessions/#{session_record.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['ended']).to be true
      expect(session_record.reload.status).to eq('ended')
    end
  end
end
