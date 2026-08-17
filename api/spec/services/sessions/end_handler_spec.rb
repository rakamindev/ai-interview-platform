# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sessions::EndHandler, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment, status: "active", started_at: 10.minutes.ago) } }

  describe "#call" do
    it "sets expires_at based on the configured retention window" do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with("CANDIDATE_DATA_RETENTION_DAYS", "90").and_return("30")

      described_class.new(session_record).call(reason: "manual_candidate")

      expect(session_record.reload.expires_at).to be_within(5.seconds).of(30.days.from_now)
    end

    it "does not overwrite expires_at on an already-ended session" do
      described_class.new(session_record).call(reason: "manual_candidate")
      first_expiry = session_record.reload.expires_at

      described_class.new(session_record).call(reason: "manual_candidate")

      expect(session_record.reload.expires_at).to eq(first_expiry)
    end
  end
end
