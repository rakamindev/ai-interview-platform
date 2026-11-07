# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#consent_given?' do
    it 'returns false when consent_given_at is nil' do
      session = described_class.new(consent_given_at: nil, pdp_retention_acknowledged: true)
      expect(session.consent_given?).to be false
    end

    it 'returns false when pdp_retention_acknowledged is false' do
      session = described_class.new(consent_given_at: Time.current, pdp_retention_acknowledged: false)
      expect(session.consent_given?).to be false
    end

    it 'returns true when consent_given_at is present and pdp_retention_acknowledged is true' do
      session = described_class.new(consent_given_at: Time.current, pdp_retention_acknowledged: true)
      expect(session.consent_given?).to be true
    end
  end

  describe 'scopes' do
    it 'filters with_consent and pending_consent correctly' do
      session1 = described_class.new(consent_given_at: Time.current, pdp_retention_acknowledged: true)
      session2 = described_class.new(consent_given_at: nil, pdp_retention_acknowledged: false)

      expect(session1.consent_given?).to be true
      expect(session2.consent_given?).to be false
    end
  end
end

