# frozen_string_literal: true

require 'rails_helper'

# F-06: POST /api/v1/sessions/:token/audio_complete must only end an active session
# when the WebSocket layer persisted a fresh preparing_to_end proof. Without it the
# endpoint returns 409 — a leaked invite token can no longer force-end a session.
RSpec.describe 'Sessions audio_complete authorization', type: :request do
  let(:org) do
    Organization.create!(
      name: 'F06 Corp', scheme: 'f06-test', identifier: 'f06-test', host: 'f06.test.local'
    )
  end

  let(:assessment) do
    Current.using(tenant_id: org.id) do
      Assessment.create!(name: 'F06 Assessment', tenant_id: org.id, created_by: 1, time_limit_min: 30)
    end
  end

  let(:session) do
    Current.using(tenant_id: org.id) do
      Session.create!(
        assessment_id: assessment.id, tenant_id: org.id,
        candidate_id: 'cand-f06', candidate_name: 'Cand F06', status: 'active'
      )
    end
  end

  def post_audio_complete(token = session.invite_token)
    post "/api/v1/sessions/#{token}/audio_complete"
  end

  def json_body
    JSON.parse(response.body)
  end

  describe 'AC#1 — no preparing_to_end proof → 409, session stays active, no side-effects' do
    it 'rejects the end and leaves the session untouched' do
      post_audio_complete

      expect(response).to have_http_status(:conflict)
      expect(json_body.dig('error', 'code')).to eq('conflict')
      expect(json_body.dig('error', 'message')).to eq('Session is not ready to end')

      expect(session.reload.status).to eq('active')
      expect(Portfolio.unscoped.find_by(session_id: session.id)).to be_nil
    end
  end

  describe 'AC#2 — fresh preparing_to_end proof → 200, session ended with all_covered' do
    it 'ends the session with reason all_covered' do
      session.mark_preparing_to_end!

      post_audio_complete

      expect(response).to have_http_status(:ok)
      expect(json_body.fetch('ended')).to be(true)
      expect(json_body.fetch('message')).to eq('Session ended')

      reloaded = session.reload
      expect(reloaded.status).to eq('ended')
      expect(reloaded.end_reason).to eq('all_covered')
      expect(reloaded.ended_at).not_to be_nil
    end
  end

  describe 'AC#3 — already ended session → idempotent 200, no duplicate portfolio' do
    it 'keeps answering "Session already ended" without creating duplicates' do
      session.mark_preparing_to_end!
      post_audio_complete
      expect(response).to have_http_status(:ok)

      post_audio_complete
      expect(response).to have_http_status(:ok)
      expect(json_body.fetch('message')).to eq('Session already ended')

      expect(Portfolio.unscoped.where(session_id: session.id).count).to eq(1)
    end
  end

  describe 'AC#4 — expired preparing_to_end proof → 409, session stays active' do
    it 'rejects a stale flag outside the validity window' do
      session.update_column(:preparing_to_end_at, (Session::PREPARING_TO_END_WINDOW + 1.minute).ago)

      post_audio_complete

      expect(response).to have_http_status(:conflict)
      expect(json_body.dig('error', 'message')).to eq('Session is not ready to end')
      expect(session.reload.status).to eq('active')
    end
  end

  describe 'AC#5 — assessor end_session path is not affected by the guard' do
    it 'still lets an assessor end an active session without the flag (separate JWT path)' do
      auth = { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: org.scheme })}" }

      post "/api/v1/sessions/#{session.id}/end_session",
           params: { session: { reason: 'manual_assessor' } },
           headers: auth

      expect(response).to have_http_status(:ok)
      reloaded = session.reload
      expect(reloaded.status).to eq('ended')
      expect(reloaded.end_reason).to eq('manual_assessor')
    end
  end

  describe 'AC#6 — unknown token → 404, existing behavior preserved' do
    it 'returns Invalid or expired invite token' do
      post_audio_complete('a' * 64)

      expect(response).to have_http_status(:not_found)
      expect(json_body.dig('error', 'code')).to eq('not_found')
      expect(json_body.dig('error', 'message')).to eq('Invalid or expired invite token')
    end
  end
end