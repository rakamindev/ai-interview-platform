# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    let(:assessment) { create(:assessment) }

    before { create_list(:session, 3, assessment: assessment) }

    it 'returns sessions for the assessment' do
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['sessions'].length).to eq(3)
    end

    it 'returns 404 for non-existent assessment' do
      get '/api/v1/assessments/999999/sessions', headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    let(:assessment) { create(:assessment) }

    it 'creates a session' do
      expect {
        post "/api/v1/assessments/#{assessment.id}/sessions",
             params: { session: { candidate_id: 1001, candidate_name: 'Test' } }.to_json,
             headers: headers
      }.to change(Session, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['invite_url']).to be_present
    end
  end

  describe 'GET /api/v1/sessions/:id' do
    let(:session) { create(:session) }

    it 'returns session details with assessment info' do
      get "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['session']['id']).to eq(session.id)
      expect(body['session']['assessment']).to be_present
    end

    it 'returns 404 for non-existent session' do
      get '/api/v1/sessions/999999', headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:id/end_session' do
    let(:session) { create(:session, :active) }

    it 'ends the session' do
      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.reload.status).to eq('ended')
    end

    it 'returns error for already ended session' do
      ended_session = create(:session, :ended)
      post "/api/v1/sessions/#{ended_session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'returns error for invalid end reason' do
      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'invalid_reason' } }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'GET /api/v1/sessions/:id/coverage' do
    let(:session) { create(:session, :active, :with_coverage) }

    it 'returns coverage maps' do
      get "/api/v1/sessions/#{session.id}/coverage", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['skills']).to be_present
    end
  end

  describe 'GET /api/v1/sessions/:id/transcript' do
    let(:session) { create(:session, :active, :with_transcript) }

    it 'returns transcript turns' do
      get "/api/v1/sessions/#{session.id}/transcript", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['turns'].length).to eq(2)
      expect(body['total']).to eq(2)
    end

    it 'filters by from_turn parameter' do
      get "/api/v1/sessions/#{session.id}/transcript?from_turn=2", headers: headers

      body = JSON.parse(response.body)
      expect(body['turns'].length).to eq(1)
      expect(body['turns'][0]['turn_number']).to eq(2)
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    let(:session) { create(:session, :active) }

    it 'returns candidate info without JWT' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['session_id']).to eq(session.id)
      expect(body['role_title']).to be_present
    end

    it 'returns 404 for invalid token' do
      get '/api/v1/sessions/invalid_token/candidate'
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/audio_complete' do
    let(:session) { create(:session, :active) }

    it 'ends the session via invite token' do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['ended']).to be true
    end

    it 'handles already ended session' do
      ended_session = create(:session, :ended)
      post "/api/v1/sessions/#{ended_session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['ended']).to be true
    end
  end
end
