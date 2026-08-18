# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:assessment) { create(:assessment) }

  describe 'callbacks & validations' do
    it 'generates a 64-character invite_token automatically on create' do
      session = create(:session, assessment: assessment, invite_token: nil)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end

    it 'sets default expires_at automatically on create' do
      session = create(:session, assessment: assessment, expires_at: nil)
      expect(session.expires_at).to be_present
      expect(session.expires_at).to be > Time.current
    end

    it 'validates status inclusion' do
      valid_session = build(:session, assessment: assessment, status: 'pending')
      expect(valid_session).to be_valid

      invalid_session = build(:session, assessment: assessment, status: 'invalid_status')
      expect(invalid_session).not_to be_valid
    end
  end

  describe '#expired?' do
    it 'returns false if expires_at is in the future and status is pending' do
      session = create(:session, assessment: assessment, expires_at: 5.minutes.from_now, status: 'pending')
      expect(session.expired?).to be false
    end

    it 'returns true if expires_at is in the past' do
      session = create(:session, assessment: assessment, expires_at: 1.minute.ago, status: 'pending')
      expect(session.expired?).to be true
    end

    it 'returns true if status is explicitly expired' do
      session = create(:session, assessment: assessment, status: 'expired')
      expect(session.expired?).to be true
    end
  end

  describe '#current_status' do
    it 'returns pending when session is not expired' do
      session = create(:session, assessment: assessment, expires_at: 5.minutes.from_now, status: 'pending')
      expect(session.current_status).to eq('pending')
      expect(session.reload.status).to eq('pending')
    end

    it 'auto-syncs and persists status to expired when expires_at has passed' do
      session = create(:session, assessment: assessment, expires_at: 1.minute.ago, status: 'pending')
      expect(session.current_status).to eq('expired')
      expect(session.reload.status).to eq('expired')
    end
  end

  describe '#regenerate_token!' do
    it 'generates a new invite token, resets expiry, and resets status to pending' do
      session = create(:session, :expired, assessment: assessment)
      old_token = session.invite_token

      session.regenerate_token!(5.minutes)
      session.reload

      expect(session.invite_token).not_to eq(old_token)
      expect(session.status).to eq('pending')
      expect(session.expires_at).to be > Time.current
      expect(session.expired?).to be false
    end
  end

  describe '#extend_expiry!' do
    it 'extends expiry and resets status to pending' do
      session = create(:session, :expired, assessment: assessment)

      session.extend_expiry!(5.minutes)
      session.reload

      expect(session.status).to eq('pending')
      expect(session.expires_at).to be > Time.current
      expect(session.expired?).to be false
    end
  end
end
