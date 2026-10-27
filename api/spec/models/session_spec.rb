# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'invite_url' do
    let(:assessment) { create(:assessment) }
    let(:session) { create(:session, assessment: assessment) }

    it 'generates a unique invite token on creation' do
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end

    it 'resolves to the frontend host rather than API port 3001 in development' do
      expect(session.invite_url).to include('/interview/' + session.invite_token)
      expect(session.invite_url).not_to include(':3001')
      expect(session.invite_url).to include(':5173')
    end

    it 'respects FRONTEND_BASE_URL if configured' do
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with('FRONTEND_BASE_URL').and_return('https://app.rakamin.com')
      expect(session.invite_url).to eq("https://app.rakamin.com/interview/#{session.invite_token}")
    end
  end

  describe 'statuses and lifecycle' do
    let(:session) { create(:session) }

    it 'defaults to pending' do
      expect(session.status).to eq('pending')
      expect(session.pending?).to be true
      expect(session.active?).to be false
      expect(session.ended?).to be false
    end

    it 'allows valid end reasons' do
      session.status = 'ended'
      session.end_reason = 'all_covered'
      expect(session).to be_valid
    end

    it 'rejects invalid end reasons' do
      session.status = 'ended'
      session.end_reason = 'random_invalid_reason'
      expect(session).not_to be_valid
    end
  end
end
