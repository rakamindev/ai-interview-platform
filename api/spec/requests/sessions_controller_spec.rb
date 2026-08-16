# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::SessionsController, type: :request do # rubocop:disable Metrics/BlockLength
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }
  let(:headers_a) { auth_header_for(organization: tenant_a) }

  let!(:assessment_a) { create(:assessment, tenant_id: tenant_a.id) }
  let!(:assessment_b) { create(:assessment, tenant_id: tenant_b.id) }
  let!(:session_a) { create(:session, tenant_id: tenant_a.id, assessment: assessment_a) }
  let!(:session_b) { create(:session, tenant_id: tenant_b.id, assessment: assessment_b) }

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    it 'lists sessions of own assessment' do
      get "/api/v1/assessments/#{assessment_a.id}/sessions", headers: headers_a

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body['sessions'].map { |s| s['id'] }
      expect(ids).to include(session_a.id)
      expect(ids).not_to include(session_b.id)
    end

    it 'blocks listing sessions of another tenant assessment' do
      get "/api/v1/assessments/#{assessment_b.id}/sessions", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'requires an assessor token' do
      get "/api/v1/assessments/#{assessment_a.id}/sessions"

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do # rubocop:disable Metrics/BlockLength
    it 'creates a pending session with an invite token and URL' do
      expect do
        post "/api/v1/assessments/#{assessment_a.id}/sessions",
             params: { session: { candidate_id: 7, candidate_name: 'Budi' } },
             headers: headers_a
      end.to change(Session, :count).by(1)

      expect(response).to have_http_status(:created)
      session = Session.last
      expect(session.tenant_id).to eq(tenant_a.id)
      expect(session.assessment_id).to eq(assessment_a.id)
      expect(session.status).to eq('pending')
      expect(session.candidate_name).to eq('Budi')
      expect(session.invite_token).to be_present
      expect(response.parsed_body['invite_url']).to include("/interview/#{session.invite_token}")
    end

    it 'blocks creating a session on another tenant assessment' do
      post "/api/v1/assessments/#{assessment_b.id}/sessions",
           params: { session: { candidate_name: 'Hacked' } },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(Session.count).to eq(2)
    end

    it 'requires an assessor token' do
      post "/api/v1/assessments/#{assessment_a.id}/sessions",
           params: { session: { candidate_name: 'Budi' } }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/sessions/:id' do
    it 'shows own session with embedded assessment' do
      get "/api/v1/sessions/#{session_a.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      body = response.parsed_body['session']
      expect(body['id']).to eq(session_a.id)
      expect(body['assessment']['name']).to eq(assessment_a.name)
      expect(body['invite_token']).to eq(session_a.invite_token)
    end

    it 'blocks reading another tenant session' do
      get "/api/v1/sessions/#{session_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:id/end_session' do # rubocop:disable Metrics/BlockLength
    it 'ends a pending session with default manual_assessor reason' do
      session_a.update!(status: 'pending')

      post "/api/v1/sessions/#{session_a.id}/end_session", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(session_a.reload.status).to eq('ended')
      expect(session_a.reload.end_reason).to eq('manual_assessor')
    end

    it 'honors an explicit end reason' do
      session_a.update!(status: 'active')

      post "/api/v1/sessions/#{session_a.id}/end_session",
           params: { session: { reason: 'time_ceiling' } },
           headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(session_a.reload.end_reason).to eq('time_ceiling')
    end

    it 'rejects an unknown end reason' do
      session_a.update!(status: 'active')

      post "/api/v1/sessions/#{session_a.id}/end_session",
           params: { session: { reason: 'not_a_reason' } },
           headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session_a.reload.status).not_to eq('ended')
    end

    it 'rejects ending an already-ended session' do
      post "/api/v1/sessions/#{session_a.id}/end_session", headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'blocks ending another tenant session' do
      post "/api/v1/sessions/#{session_b.id}/end_session", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/sessions/:id/coverage' do
    it 'returns configured and discovered coverage maps' do
      create(:coverage_map, session: session_a, skill_label: 'Ruby', is_discovered: false, state: 'covered')
      create(:coverage_map, session: session_a, skill_label: 'Bonus skill', is_discovered: true, state: 'partial')

      get "/api/v1/sessions/#{session_a.id}/coverage", headers: headers_a

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['skills'].map { |s| s['skill_label'] }).to eq(%w[Ruby])
      expect(body['skills'].first['state']).to eq('covered')
      expect(body['discovered'].map { |s| s['skill_label'] }).to eq(['Bonus skill'])
    end

    it 'blocks coverage of another tenant session' do
      get "/api/v1/sessions/#{session_b.id}/coverage", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/sessions/:id/transcript' do
    it 'returns turns in order' do
      create(:transcript_turn, session: session_a, turn_number: 2, speaker: 'candidate', text: 'Hi')
      create(:transcript_turn, session: session_a, turn_number: 1, speaker: 'ai', text: 'Hello')

      get "/api/v1/sessions/#{session_a.id}/transcript", headers: headers_a

      expect(response).to have_http_status(:ok)
      turns = response.parsed_body['turns']
      expect(turns.map { |t| t['turn_number'] }).to eq([1, 2])
      expect(turns.first['speaker']).to eq('ai')
      expect(response.parsed_body['total']).to eq(2)
    end

    it 'filters by from_turn' do
      create(:transcript_turn, session: session_a, turn_number: 1, speaker: 'ai', text: 'Hello')
      create(:transcript_turn, session: session_a, turn_number: 2, speaker: 'candidate', text: 'Hi')

      get "/api/v1/sessions/#{session_a.id}/transcript?from_turn=2", headers: headers_a

      expect(response.parsed_body['turns'].map { |t| t['turn_number'] }).to eq([2])
    end

    it 'blocks transcript of another tenant session' do
      get "/api/v1/sessions/#{session_b.id}/transcript", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'returns candidate-facing session info without a JWT' do
      get "/api/v1/sessions/#{session_a.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['session_id']).to eq(session_a.id)
      expect(body['role_title']).to eq(assessment_a.name)
      expect(body['time_limit_min']).to eq(assessment_a.time_limit_min)
      expect(body['session_status']).to eq(session_a.status)
    end

    it 'returns 404 for an invalid invite token' do
      get "/api/v1/sessions/#{SecureRandom.hex(32)}/candidate"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/audio_complete' do
    it 'ends a pending session with all_covered reason' do
      session_a.update!(status: 'pending')

      post "/api/v1/sessions/#{session_a.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['ended']).to be(true)
      expect(session_a.reload.status).to eq('ended')
      expect(session_a.reload.end_reason).to eq('all_covered')
    end

    it 'is idempotent when already ended' do
      post "/api/v1/sessions/#{session_a.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['ended']).to be(true)
    end

    it 'returns 404 for an invalid invite token' do
      post "/api/v1/sessions/#{SecureRandom.hex(32)}/audio_complete"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/sessions/:token/end' do # rubocop:disable Metrics/BlockLength
    let(:session) { create(:session, status: 'pending') }

    it 'ends the session with reason manual_candidate' do
      post "/api/v1/sessions/#{session.invite_token}/end"

      expect(response).to have_http_status(:ok)
      expect(session.reload.status).to eq('ended')
      expect(session.reload.end_reason).to eq('manual_candidate')
    end

    it 'works without an assessor JWT' do
      post "/api/v1/sessions/#{session.invite_token}/end"

      expect(response).to have_http_status(:ok)
    end

    it 'is idempotent when the session already ended' do
      session.update!(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)

      post "/api/v1/sessions/#{session.invite_token}/end"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['ended']).to be(true)
    end

    it 'does not overwrite a prior clean end_reason' do
      session.update!(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)

      post "/api/v1/sessions/#{session.invite_token}/end"

      expect(session.reload.end_reason).to eq('all_covered')
    end

    it 'returns 404 for an invalid invite token' do
      post "/api/v1/sessions/#{SecureRandom.hex(32)}/end"

      expect(response).to have_http_status(:not_found)
    end
  end
end
