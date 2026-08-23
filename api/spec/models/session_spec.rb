# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:assessment) }
    it { is_expected.to have_many(:transcript_turns).dependent(:destroy) }
    it { is_expected.to have_many(:coverage_maps).dependent(:destroy) }
    it { is_expected.to have_one(:portfolio).dependent(:destroy) }
  end

  describe 'validations' do
    subject { build(:session) }

    it { is_expected.to validate_inclusion_of(:status).in_array(%w[pending active ended failed]) }

    it 'validates invite_token uniqueness' do
      create(:session, invite_token: 'unique_token')
      duplicate = build(:session, invite_token: 'unique_token')
      duplicate.validate
      expect(duplicate.errors[:invite_token]).to include('has already been taken')
    end

    it 'validates end_reason inclusion when present' do
      session = build(:session, end_reason: 'invalid')
      session.validate
      expect(session.errors[:end_reason]).to include('is not included in the list')
    end

    it 'allows nil end_reason' do
      session = build(:session, end_reason: nil)
      expect(session).to be_valid
    end

    it 'generates invite_token automatically' do
      session = build(:session, invite_token: nil)
      session.validate
      expect(session.invite_token).to be_present
    end
  end

  describe 'callbacks' do
    it 'generates invite_token on create when not provided' do
      session = create(:session, invite_token: nil)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end

    it 'does not overwrite invite_token if already present' do
      token = 'custom_token_abc123'
      session = create(:session, invite_token: token)
      expect(session.invite_token).to eq(token)
    end
  end

  describe 'scopes' do
    let!(:pending_session) { create(:session, status: 'pending') }
    let!(:active_session) { create(:session, :active) }
    let!(:ended_session) { create(:session, :ended) }

    describe '.active' do
      it 'returns active sessions' do
        expect(Session.active).to include(active_session)
        expect(Session.active).not_to include(pending_session, ended_session)
      end
    end

    describe '.pending' do
      it 'returns pending sessions' do
        expect(Session.pending).to include(pending_session)
        expect(Session.pending).not_to include(active_session, ended_session)
      end
    end

    describe '.ended' do
      it 'returns ended sessions' do
        expect(Session.ended).to include(ended_session)
        expect(Session.ended).not_to include(pending_session, active_session)
      end
    end
  end

  describe 'instance methods' do
    describe '#active?' do
      it 'returns true when status is active' do
        session = build(:session, status: 'active')
        expect(session.active?).to be true
      end

      it 'returns false when status is not active' do
        session = build(:session, status: 'pending')
        expect(session.active?).to be false
      end
    end

    describe '#ended?' do
      it 'returns true when status is ended' do
        session = build(:session, status: 'ended')
        expect(session.ended?).to be true
      end

      it 'returns false when status is not ended' do
        session = build(:session, status: 'active')
        expect(session.ended?).to be false
      end
    end

    describe '#pending?' do
      it 'returns true when status is pending' do
        session = build(:session, status: 'pending')
        expect(session.pending?).to be true
      end

      it 'returns false when status is not pending' do
        session = build(:session, status: 'active')
        expect(session.pending?).to be false
      end
    end

    describe '#invite_url' do
      it 'generates URL with APP_BASE_URL' do
        session = build(:session, invite_token: 'abc123')
        allow(ENV).to receive(:fetch).with('APP_BASE_URL', 'http://localhost:3001').and_return('http://localhost:3001')
        expect(session.invite_url).to eq('http://localhost:3001/interview/abc123')
      end
    end
  end
end
