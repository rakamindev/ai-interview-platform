# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/sessions/:token/audio_complete', type: :request do
  let(:org)       { create_organization }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)   { build_session(tenant: org, assessment: assessment) }

  # A session that genuinely ran: active status, consent given, transcript present.
  def build_running_session
    create_consent(session: session, status: 'accepted')
    session.update!(status: 'active', started_at: Time.current)
    session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Hello')
    session
  end

  describe 'hijack protection' do
    it 'ends the session on the happy path (running + consent + transcript)' do
      build_running_session

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(session.reload.status).to eq('ended')
      expect(session.reload.end_reason).to eq('all_covered')
    end

    it 'rejects without consent and does not end the session' do
      session.update!(status: 'active', started_at: Time.current)
      session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Hello')

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.status).not_to eq('ended')
    end

    it 'rejects a session that never ran (pending, no transcript)' do
      create_consent(session: session, status: 'accepted')

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.status).to eq('pending')
    end

    it 'rejects a session with consent but no transcript turns' do
      create_consent(session: session, status: 'accepted')
      session.update!(status: 'active', started_at: Time.current)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.status).to eq('active')
    end

    it 'does not leak internal details in the error' do
      session.update!(status: 'active', started_at: Time.current)
      session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Hello')

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      body = JSON.parse(response.body)
      expect(body.dig('errors', 0, 'message')).to be_present
      expect(body.to_s).not_to include('transcript')
      expect(body.to_s).not_to include('consent')
    end

    it 'returns 404 for an unknown token' do
      post '/api/v1/sessions/nope/audio_complete'
      expect(response).to have_http_status(:not_found)
    end

    it 'remains idempotent for an already-ended session' do
      build_running_session
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"
      expect(response).to have_http_status(:ok)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['ended']).to be true
      expect(session.reload.end_reason).to eq('all_covered')
    end
  end
end
