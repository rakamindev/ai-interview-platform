# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Consent, type: :model do
  describe 'validations' do
    it 'requires a version' do
      consent = build(:consent, version: nil)
      expect(consent).not_to be_valid
      expect(consent.errors[:version]).to be_present
    end

    it 'requires granted_at' do
      consent = build(:consent, granted_at: nil)
      expect(consent).not_to be_valid
      expect(consent.errors[:granted_at]).to be_present
    end

    it 'allows only one consent per session' do
      session = create(:session)
      create(:consent, session: session)
      duplicate = build(:consent, session: session)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:session_id]).to be_present
    end

    it 'is invalid with an unknown status' do
      consent = build(:consent, status: 'invalid_status')
      expect(consent).not_to be_valid
      expect(consent.errors[:status]).to be_present
    end
  end

  describe 'tenant scoping' do
    it 'stores tenant_id from the session (AC-B2)' do
      consent = create(:consent)
      expect(consent.tenant_id).to eq(consent.session.tenant_id)
    end
  end

  describe 'uniqueness (AC-B2)' do
    it 'allows only one consent per session' do
      session = create(:session)
      create(:consent, session: session)
      duplicate = build(:consent, session: session)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:session_id]).to be_present
    end
  end

  describe 'granted? / revoked?' do
    it 'reports granted status' do
      expect(build(:consent, status: 'granted')).to be_granted
    end

    it 'reports revoked status' do
      expect(build(:consent, status: 'revoked', granted_at: 1.hour.ago, revoked_at: 1.minute.ago)).to be_revoked
    end
  end
end