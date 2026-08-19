# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'validations' do
    it 'validates status inclusion' do
      session = build(:session, status: 'invalid')
      expect(session).not_to be_valid
      expect(session.errors[:status]).to be_present
    end

    it 'validates status is one of the allowed values' do
      Session::STATUSES.each do |status|
        session = build(:session, status: status)
        expect(session).to be_valid
      end
    end

    it 'validates invite_token uniqueness' do
      existing = create(:session)
      duplicate = build(:session, invite_token: existing.invite_token)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:invite_token]).to be_present
    end

    it 'validates invite_token presence' do
      session = Session.new
      session.valid?
      # invite_token is auto-generated on create, so test by checking it exists after validation
      expect(session.invite_token).to be_present
    end
  end

  describe 'associations' do
    it { should belong_to(:assessment) }
    it { should have_many(:transcript_turns).dependent(:destroy) }
    it { should have_many(:coverage_maps).dependent(:destroy) }
    it { should have_one(:portfolio).dependent(:destroy) }
  end

  describe 'callbacks' do
    it 'generates invite_token on create' do
      session = create(:session)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64) # 32 bytes hex
    end

    it 'does not overwrite invite_token if already set' do
      token = 'custom_token_abc123'
      session = create(:session, invite_token: token)
      expect(session.invite_token).to eq(token)
    end
  end

  describe 'scopes' do
    let!(:pending_session) { create(:session, status: 'pending') }
    let!(:active_session) { create(:session, :active) }
    let!(:ended_session) { create(:session, :ended) }

    it '.pending returns pending sessions' do
      expect(Session.pending).to include(pending_session)
      expect(Session.pending).not_to include(active_session)
    end

    it '.active returns active sessions' do
      expect(Session.active).to include(active_session)
      expect(Session.active).not_to include(pending_session)
    end

    it '.ended returns ended sessions' do
      expect(Session.ended).to include(ended_session)
      expect(Session.ended).not_to include(active_session)
    end
  end

  describe 'status methods' do
    it '#active? returns true when status is active' do
      session = build(:session, status: 'active')
      expect(session.active?).to be true
    end

    it '#ended? returns true when status is ended' do
      session = build(:session, status: 'ended')
      expect(session.ended?).to be true
    end

    it '#pending? returns true when status is pending' do
      session = build(:session, status: 'pending')
      expect(session.pending?).to be true
    end
  end

  describe '#invite_url' do
    it 'returns a URL with the invite token' do
      session = create(:session)
      expect(session.invite_url).to include(session.invite_token)
      expect(session.invite_url).to include('/interview/')
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:session)).to be_valid
    end

    it 'has a valid active trait' do
      expect(build(:session, :active)).to be_valid
    end

    it 'has a valid ended trait' do
      expect(build(:session, :ended)).to be_valid
    end
  end
end
