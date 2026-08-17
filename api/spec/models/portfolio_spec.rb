# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolio, type: :model do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }
  let(:portfolio) { Current.using(tenant_id: org.id) { create(:portfolio, session: session) } }

  describe "#recompute_verdict!" do
    it "sets pass when the average skill level is 4 or above" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 4) }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 5) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict).to eq("pass")
    end

    it "sets consider when the average is between 2.5 and 4" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 3) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict).to eq("consider")
    end

    it "sets failed when the average is below 2.5" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 2) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict).to eq("failed")
    end

    it "leaves verdict nil when there are no skills yet" do
      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict).to be_nil
    end

    it "uses the assessor override level instead of the AI level when one exists" do
      skill = Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, ai_level: 1) }
      Current.using(tenant_id: org.id) do
        skill.build_assessor_override(ai_level: 1, override_level: 5, overridden_by: 1, overridden_at: Time.current).save!
      end

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict).to eq("pass")
    end
  end
end
