# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Sessions', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }
  let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
  let!(:session) { create(:session, :active, assessment: assessment) }

  before { with_tenant }

  describe 'GET /api/v1/sessions/:id' do
    it 'returns session with assessment details' do
      get "/api/v1/sessions/#{session.id}", headers: headers

      expect_json_response
      expect(json_body['session']['id']).to eq(session.id)
      expect(json_body['session']['assessment']).to be_present
    end

    it 'returns 404 for non-existent session' do
      get '/api/v1/sessions/99999', headers: headers

      expect_error(status: :not_found)
    end
  end

  describe 'POST /api/v1/sessions/:id/end_session' do
    it 'ends an active session' do
      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: headers

      expect_json_response
      expect(json_body['session']['status']).to eq('ended')
    end

    it 'returns error for already ended session' do
      session.update!(status: 'ended', end_reason: 'manual_assessor')

      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: headers

      expect_error(status: :unprocessable_entity, message: 'already ended')
    end

    it 'returns error for invalid reason' do
      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'invalid_reason' } },
           headers: headers

      expect_error(status: :unprocessable_entity, message: 'Invalid end reason')
    end
  end

  describe 'GET /api/v1/sessions/:id/coverage' do
    let!(:coverage_map) { create(:coverage_map, session: session, skill_label: 'Test Skill') }

    it 'returns coverage maps' do
      get "/api/v1/sessions/#{session.id}/coverage", headers: headers

      expect_json_response
      expect(json_body['skills'].size).to eq(1)
      expect(json_body['skills'].first['skill_label']).to eq('Test Skill')
    end
  end

  describe 'GET /api/v1/sessions/:id/transcript' do
    let!(:turn1) { create(:transcript_turn, session: session, turn_number: 1, speaker: 'ai', text: 'Hello') }
    let!(:turn2) { create(:transcript_turn, session: session, turn_number: 2, speaker: 'candidate', text: 'Hi') }

    it 'returns all transcript turns' do
      get "/api/v1/sessions/#{session.id}/transcript", headers: headers

      expect_json_response
      expect(json_body['turns'].size).to eq(2)
      expect(json_body['total']).to eq(2)
    end

    it 'filters by from_turn parameter' do
      get "/api/v1/sessions/#{session.id}/transcript?from_turn=2", headers: headers

      expect_json_response
      expect(json_body['turns'].size).to eq(1)
      expect(json_body['turns'].first['turn_number']).to eq(2)
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    let(:candidate_session) { create(:session, :active, assessment: assessment) }

    it 'returns candidate info without JWT' do
      get "/api/v1/sessions/#{candidate_session.invite_token}/candidate"

      expect_json_response
      expect(json_body['session_id']).to eq(candidate_session.id)
      expect(json_body['role_title']).to eq(assessment.name)
    end

    it 'returns 404 for invalid token' do
      get '/api/v1/sessions/invalid_token/candidate'

      expect_error(status: :not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/audio_complete' do
    let(:candidate_session) { create(:session, :active, assessment: assessment) }

    it 'ends session with all_covered reason' do
      post "/api/v1/sessions/#{candidate_session.invite_token}/audio_complete"

      expect_json_response
      expect(json_body['ended']).to be true
      expect(candidate_session.reload.status).to eq('ended')
    end

    it 'returns error for invalid token' do
      post '/api/v1/sessions/invalid_token/audio_complete'

      expect_error(status: :not_found)
    end

    it 'returns already ended message for ended session' do
      candidate_session.update!(status: 'ended')

      post "/api/v1/sessions/#{candidate_session.invite_token}/audio_complete"

      expect_json_response
      expect(json_body['ended']).to be true
      expect(json_body['message']).to include('already ended')
    end
  end
end