# frozen_string_literal: true

require 'rails_helper'

# F19: the invite page must tell a candidate whose session ended on an error that it failed,
# so the API has to say why the session ended — not only that it did.
RSpec.describe 'Candidate session info', type: :request do
  it 'includes why the session ended' do
    session = create(:session, status: 'ended', end_reason: 'error')

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include('session_status' => 'ended', 'end_reason' => 'error')
  end

  # F20: the server ends the interview at started_at + time limit. A candidate who rejoins must see
  # the time actually left, not a fresh full countdown.
  describe 'remaining_seconds' do
    let(:assessment) { create(:assessment, time_limit_min: 10) }

    it 'is the time left on the server clock for a session already in progress' do
      session = create(:session, assessment: assessment, status: 'active', started_at: 8.minutes.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response.parsed_body['remaining_seconds']).to be_within(2).of(120)
    end

    it 'is the full limit before the interview has started' do
      session = create(:session, assessment: assessment, status: 'pending')

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response.parsed_body['remaining_seconds']).to eq(600)
    end

    it 'never goes below zero once the limit has passed' do
      session = create(:session, assessment: assessment, status: 'active', started_at: 15.minutes.ago)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response.parsed_body['remaining_seconds']).to eq(0)
    end
  end
end
