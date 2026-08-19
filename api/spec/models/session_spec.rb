require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'invite token expiry' do
    it 'sets invite_expires_at based on INVITE_TOKEN_TTL_HOURS on creation' do
      session = create(:session)

      expect(session.invite_expires_at).to be_present
      expect(session.invite_expires_at).to be_within(1.second).of(session.created_at + 72.hours)
    end

    it 'honors INVITE_TOKEN_TTL_HOURS override' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('INVITE_TOKEN_TTL_HOURS', 72).and_return('24')

      session = create(:session)

      expect(session.invite_expires_at).to be_within(1.second).of(session.created_at + 24.hours)
    end
  end

  describe '#invite_expired?' do
    it 'is false for a pending session before its expiry time' do
      session = create(:session)

      expect(session.invite_expired?).to be false
    end

    it 'is true for a pending session past its expiry time' do
      session = create(:session)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        expect(session.invite_expired?).to be true
      end
    end

    it 'is false for an active session past its expiry time (AC-3: expiry gates starting, not continuing)' do
      session = create(:session, status: 'active', started_at: Time.current)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        expect(session.invite_expired?).to be false
      end
    end

    it 'is false for an ended session past its expiry time' do
      session = create(:session, status: 'ended', started_at: 1.hour.ago, ended_at: Time.current)

      Timecop.travel(session.invite_expires_at + 1.minute) do
        expect(session.invite_expired?).to be false
      end
    end
  end

  describe 'candidate_name integrity (F-003)' do
    it 'allows changing candidate_name while the session is still pending' do
      session = create(:session, candidate_name: 'Original Name')

      session.update(candidate_name: 'Corrected Typo')

      expect(session.reload.candidate_name).to eq('Corrected Typo')
    end

    it 'rejects changing candidate_name once the session is active' do
      session = create(:session, candidate_name: 'Original Name', status: 'active', started_at: Time.current)

      result = session.update(candidate_name: 'Different Name')

      expect(result).to be false
      expect(session.errors[:candidate_name]).to be_present
      expect(session.reload.candidate_name).to eq('Original Name')
    end

    it 'rejects changing candidate_name once the session has ended' do
      session = create(:session, candidate_name: 'Original Name', status: 'ended', started_at: 1.hour.ago, ended_at: Time.current)

      result = session.update(candidate_name: 'Different Name')

      expect(result).to be false
      expect(session.reload.candidate_name).to eq('Original Name')
    end

    it 'allows other fields to change on a non-pending session (only candidate_name is locked)' do
      session = create(:session, status: 'active', started_at: Time.current)

      result = session.update(status: 'ended', ended_at: Time.current, end_reason: 'manual_assessor')

      expect(result).to be true
    end
  end

  describe '#extend_invite!' do
    it 'pushes invite_expires_at forward from now, on the same record' do
      session = create(:session)
      original_id = session.id

      Timecop.travel(session.invite_expires_at + 1.minute) do
        expect(session.invite_expired?).to be true

        session.extend_invite!

        expect(session.id).to eq(original_id)
        expect(session.invite_expired?).to be false
        expect(session.invite_expires_at).to be_within(1.second).of(Time.current + 72.hours)
      end
    end
  end
end
