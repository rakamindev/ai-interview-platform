# frozen_string_literal: true

require 'rails_helper'

# UU PDP: candidate consent is the lawful basis for processing interview
# data. It must be recorded server-side (timestamped) and gate both the
# candidate_info surface and the audio WebSocket.
RSpec.describe 'Candidate consent', type: :request do
  let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
  let!(:session) { create(:session, :active, assessment: assessment) }

  describe 'POST /api/v1/sessions/:token/consent' do
    it 'records a timestamped consent' do
      expect {
        post "/api/v1/sessions/#{session.invite_token}/consent"
      }.to change { session.reload.consent_given_at }.from(nil).to(be_within(5).of(Time.current))

      expect_json_response
      expect(json_body['consent_recorded']).to be true
    end

    it 'is idempotent — first timestamp wins, never rolled back' do
      post "/api/v1/sessions/#{session.invite_token}/consent"
      first = session.reload.consent_given_at

      Timecop.travel(1.hour.from_now) do
        post "/api/v1/sessions/#{session.invite_token}/consent"
      end

      expect(session.reload.consent_given_at).to eq(first)
    end

    it 'returns 404 for invalid tokens' do
      post '/api/v1/sessions/invalid_token/consent'

      expect_error(status: :not_found)
    end
  end

  describe 'candidate_info exposes consent state' do
    it 'reports consent_given: false before consent' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(json_body['consent_given']).to be false
    end

    it 'reports consent_given: true after consent' do
      session.update!(consent_given_at: Time.current)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(json_body['consent_given']).to be true
    end
  end
end
