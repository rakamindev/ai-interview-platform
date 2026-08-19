# frozen_string_literal: true

require "rails_helper"

RSpec.describe Candidates::Query, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }

  def make_session(**attrs)
    Current.using(tenant_id: org.id) { create(:session, assessment: assessment, **attrs) }
  end

  describe "validation" do
    it "is invalid for an unsupported interview_status" do
      result = described_class.call(assessment: assessment, interview_status: "bogus")

      expect(result.valid?).to be false
      expect(result.errors.first).to include("invalid interview_status")
      expect(result.relation).to be_nil
    end

    it "is invalid for an unsupported verdict" do
      result = described_class.call(assessment: assessment, verdict: "maybe")

      expect(result.valid?).to be false
      expect(result.errors.first).to include("invalid verdict")
    end

    it "is invalid for an unsupported sort field" do
      result = described_class.call(assessment: assessment, sort: "shoe_size")

      expect(result.valid?).to be false
      expect(result.errors.first).to include("invalid sort")
    end

    it "is valid with no filters, defaulting to interview_date desc" do
      result = described_class.call(assessment: assessment)

      expect(result.valid?).to be true
    end

    it "falls back to desc for an invalid direction instead of rejecting the query" do
      make_session(candidate_name: "Amy")
      result = described_class.call(assessment: assessment, sort: "name", direction: "sideways")

      expect(result.valid?).to be true
      expect(result.relation.to_sql).to include("DESC")
    end
  end

  describe "#call" do
    it "scopes to the given assessment only" do
      other_assessment = Current.using(tenant_id: org.id) { create(:assessment) }
      make_session(candidate_name: "Mine")
      Current.using(tenant_id: org.id) { create(:session, assessment: other_assessment, candidate_name: "Theirs") }

      result = described_class.call(assessment: assessment)

      expect(result.relation.pluck(:candidate_name)).to eq(["Mine"])
    end

    it "searches case-insensitively and trims surrounding whitespace" do
      make_session(candidate_name: "Alice Wonderland")
      make_session(candidate_name: "Bob Builder")

      result = described_class.call(assessment: assessment, search: "  ALICE  ")

      expect(result.relation.pluck(:candidate_name)).to eq(["Alice Wonderland"])
    end

    it "translates the completed interview_status filter to the ended session status" do
      make_session(candidate_name: "Done", status: "ended", started_at: 1.day.ago)
      make_session(candidate_name: "Waiting", status: "pending")

      result = described_class.call(assessment: assessment, interview_status: "completed")

      expect(result.relation.pluck(:candidate_name)).to eq(["Done"])
    end

    it "filters by verdict via the joined portfolio" do
      pass_session = make_session(candidate_name: "Passer")
      Current.using(tenant_id: org.id) { create(:portfolio, session: pass_session, verdict: "pass") }
      fail_session = make_session(candidate_name: "Failer")
      Current.using(tenant_id: org.id) { create(:portfolio, session: fail_session, verdict: "failed") }

      result = described_class.call(assessment: assessment, verdict: "pass")

      expect(result.relation.pluck(:candidate_name)).to eq(["Passer"])
    end

    it "sorts by name ascending with id as a deterministic tiebreaker" do
      make_session(candidate_name: "Zed")
      make_session(candidate_name: "Amy")

      result = described_class.call(assessment: assessment, sort: "name", direction: "asc")

      expect(result.relation.pluck(:candidate_name)).to eq(%w[Amy Zed])
    end

    it "sorts candidates with no verdict last regardless of direction" do
      with_verdict = make_session(candidate_name: "HasVerdict")
      Current.using(tenant_id: org.id) { create(:portfolio, session: with_verdict, verdict: "pass") }
      without_verdict = make_session(candidate_name: "NoVerdict")

      result = described_class.call(assessment: assessment, sort: "verdict", direction: "asc")

      expect(result.relation.pluck(:candidate_name)).to eq(["HasVerdict", "NoVerdict"])
    end
  end
end
