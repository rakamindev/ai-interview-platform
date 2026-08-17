# frozen_string_literal: true

require "rails_helper"

RSpec.describe Session, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }

  describe "#purge_personal_data!" do
    let(:session_record) do
      Current.using(tenant_id: org.id) { create(:session, assessment: assessment, candidate_name: "Budi Santoso") }
    end

    before do
      Current.using(tenant_id: org.id) { create(:transcript_turn, session: session_record, text: "My name is Budi") }
    end

    it "replaces candidate_name and every transcript turn's text with a marker" do
      session_record.purge_personal_data!

      expect(session_record.reload.candidate_name).to eq(Session::PURGED_NAME_MARKER)
      expect(session_record.transcript_turns.reload.pluck(:text)).to all(eq(Session::PURGED_TEXT_MARKER))
    end

    it "records data_purged_at" do
      session_record.purge_personal_data!

      expect(session_record.reload.data_purged_at).to be_present
    end

    it "is idempotent — calling it twice does not raise or change the timestamp" do
      session_record.purge_personal_data!
      first_purge_time = session_record.reload.data_purged_at

      session_record.purge_personal_data!

      expect(session_record.reload.data_purged_at).to eq(first_purge_time)
    end

    it "leaves the portfolio's verdict and skills untouched" do
      portfolio = Current.using(tenant_id: org.id) { create(:portfolio, session: session_record, verdict: "pass") }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 5) }

      session_record.purge_personal_data!

      expect(portfolio.reload.verdict).to eq("pass")
      expect(portfolio.portfolio_skills.count).to eq(1)
    end
  end

  describe ".expired_for_purge" do
    it "includes sessions past their expiry that have not been purged" do
      expired = Current.using(tenant_id: org.id) { create(:session, assessment: assessment, status: "ended", expires_at: 1.day.ago) }
      Current.using(tenant_id: org.id) { create(:session, assessment: assessment, status: "ended", expires_at: 1.day.from_now) }
      already_purged = Current.using(tenant_id: org.id) { create(:session, assessment: assessment, status: "ended", expires_at: 1.day.ago, data_purged_at: Time.current) }

      results = Session.unscoped.expired_for_purge

      expect(results).to include(expired)
      expect(results).not_to include(already_purged)
    end
  end
end
