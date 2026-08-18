# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }

  describe 'invite token expiry' do
    it 'rejects an expired invite token on candidate_info' do
      session.update_column(:invite_expires_at, 1.day.ago)

      get "/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)['message']).to include('expired')
    end

    it 'allows a valid invite token on candidate_info' do
      session.update_column(:invite_expires_at, 14.days.from_now)

      get "/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
    end

    it 'rejects an expired invite token on audio_complete' do
      session.update_column(:invite_expires_at, 1.day.ago)

      post "/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:unauthorized)
    end

    it 'allows a valid invite token on audio_complete' do
      session.update_column(:invite_expires_at, 14.days.from_now)
      session.update!(status: 'ended')  # Already ended → idempotent

      post "/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['ended']).to be true
    end
  end

  describe 'invite token generation' do
    it 'sets invite_expires_at on create' do
      new_session = create(:session, assessment: assessment, tenant_id: org.id)

      expect(new_session.invite_expires_at).to be_present
      expect(new_session.invite_expires_at).to be > Time.current
    end
  end
end
