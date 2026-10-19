# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/sessions/:token/audio_complete', type: :request do
  let!(:org) { ensure_organization(scheme: 'audio-complete-spec', name: 'AC Spec', identifier: 'audio-complete-spec', host: 'ac.local') }
  let(:assessment) { create_assessment_for(org.id) }

  def post_audio_complete(session)
    post "/api/v1/sessions/#{session.invite_token}/audio_complete"
  end

  describe 'PD-005 — authorization before auto-end' do
    let(:session) { create_session_for(assessment, org.id, status: 'active') }

    before do
      create_coverage_map(session, state: 'not_yet')
    end

    it 'rejects premature complete without coverage or WS gate' do
      post_audio_complete(session)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig('errors', 0, 'message')).to include('not ready')
      expect(session.reload.status).to eq('active')
    end

    it 'allows complete when coverage is fully covered' do
      session.coverage_maps.update_all(state: 'covered', probe_count: 3)

      post_audio_complete(session)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['ended']).to eq(true)
      expect(session.reload.status).to eq('ended')
      expect(session.end_reason).to eq('all_covered')
    end

    it 'allows complete when WebSocket issued auto-end gate (async coverage lag)' do
      Sessions::AutoEndGate.permit!(session.id)

      post_audio_complete(session)

      expect(response).to have_http_status(:ok)
      expect(session.reload.status).to eq('ended')
    end
  end

  it 'is idempotent when session already ended' do
    session = create_session_for(assessment, org.id, status: 'ended')
    session.update!(end_reason: 'manual_candidate', ended_at: Time.current)

    post_audio_complete(session)

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['ended']).to eq(true)
  end
end
