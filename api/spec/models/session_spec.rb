# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'validations' do
    it 'generates a secure invite token on creation' do
      session = create(:session)

      expect(session.invite_token).to be_present
      expect(session.invite_token).to match(/\A[a-f0-9]{64}\z/)
    end

    it 'generates a unique invite token for each session' do
      first = create(:session)
      second = create(:session)

      expect(second.invite_token).not_to eq(first.invite_token)
    end

    it 'rejects unsupported statuses' do
      session = build(:session, status: 'unknown')

      expect(session).not_to be_valid
      expect(session.errors[:status]).to be_present
    end

    it 'rejects unsupported end reasons' do
      session = build(:session, status: 'ended', end_reason: 'unknown')

      expect(session).not_to be_valid
      expect(session.errors[:end_reason]).to be_present
    end
  end

  describe '#invite_url' do
    it 'uses the configured application base URL' do
      session = build(:session, invite_token: 'abc123')
      allow(ENV).to receive(:fetch).with('APP_BASE_URL', 'http://localhost:3001').and_return('https://interview.example.test')

      expect(session.invite_url).to eq('https://interview.example.test/interview/abc123')
    end
  end
end
