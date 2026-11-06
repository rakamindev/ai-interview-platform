# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "Candidate invite access", type: :request do
  let(:session) { create(:session) }

  describe "GET /api/v1/sessions/:token/candidate" do
    it "opens a fresh link and asks for consent" do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = json_body
      expect(body['session_id']).to eq(session.id)
      expect(body['invite_status']).to eq('pending')
      expect(body['consent_required']).to be(true)
      expect(body['consent_given_at']).to be_nil
      expect(body['expires_at']).to be_present
      expect(body['language']).to eq('en')
    end

    it "rejects an expired link with a precise code" do
      session.update!(invite_expires_at: 1.minute.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:gone)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_expired')
    end

    it "rejects a revoked link with a precise code" do
      session.update!(invite_revoked_at: Time.current)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:gone)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_revoked')
    end

    it "rejects a link while the interview is live" do
      session.update!(status: 'active', started_at: Time.current)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:gone)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_in_progress')
    end

    it "rejects a completed link instead of pretending it is still open" do
      session.update!(status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:gone)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_completed')
    end

    it "returns not_found for an unknown token" do
      get "/api/v1/sessions/not-a-real-token/candidate"

      expect(response).to have_http_status(:not_found)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_not_found')
    end
  end

  describe "POST /api/v1/sessions/:token/consent" do
    it "records consent with a timestamp" do
      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      expect(json_body['consent_required']).to be(false)
      expect(json_body['consent_given_at']).to be_present
      expect(session.reload.consent_given_at).to be_present
    end

    it "is idempotent when called twice" do
      post "/api/v1/sessions/#{session.invite_token}/consent"
      first = json_body['consent_given_at']

      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:ok)
      expect(json_body['consent_given_at']).to eq(first)
    end

    it "refuses consent on an expired link" do
      session.update!(invite_expires_at: 1.minute.ago)

      post "/api/v1/sessions/#{session.invite_token}/consent"

      expect(response).to have_http_status(:gone)
      expect(session.reload.consent_given_at).to be_nil
    end
  end

  describe "POST /api/v1/sessions/:token/audio_complete" do
    it "is idempotent for an already ended session" do
      session.update!(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(json_body['ended']).to be(true)
    end

    it "rejects completion for an expired link" do
      session.update!(invite_expires_at: 1.minute.ago)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:gone)
      expect(json_body.dig('errors', 0, 'code')).to eq('invite_expired')
    end
  end
end
