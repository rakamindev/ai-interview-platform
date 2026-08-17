# frozen_string_literal: true

require "rails_helper"

RSpec.describe Session, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }

  describe "#consent_given?" do
    it "is false when no consent record exists" do
      expect(session_record.consent_given?).to be false
    end

    it "is false when consent was declined" do
      session_record.create_consent!(given: false, policy_version: Consent::CURRENT_POLICY_VERSION)

      expect(session_record.consent_given?).to be false
    end

    it "is true when consent was given" do
      session_record.create_consent!(given: true, given_at: Time.current, policy_version: Consent::CURRENT_POLICY_VERSION)

      expect(session_record.consent_given?).to be true
    end
  end
end
