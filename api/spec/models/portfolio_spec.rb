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

  describe "#recompute_verdict! verdict_summary" do
    it "is nil when there are no skills" do
      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to be_nil
    end

    it "mentions strengths and concerns when both exist" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 5) }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "SQL", ai_level: 1) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Strong on React. Less certain on SQL — worth a follow-up before deciding."
      )
    end

    it "praises across the board when only strengths exist" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 5) }
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "Node.js", ai_level: 4) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Strong across the board, especially React and Node.js."
      )
    end

    it "flags a single weak skill as a narrow, inconclusive read" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 2) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Only tested on React, and the result was weak or uncertain — treat this as a narrow, inconclusive read."
      )
    end

    it "treats a non-overridden low-confidence skill as a concern even at a mid level" do
      Current.using(tenant_id: org.id) do
        create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 5)
        create(:portfolio_skill, portfolio: portfolio, skill_label: "SQL", ai_level: 3, ai_confidence: "low")
      end

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Strong on React. Less certain on SQL — worth a follow-up before deciding."
      )
    end

    it "does not treat an overridden skill's low ai_confidence as a concern" do
      skill = Current.using(tenant_id: org.id) do
        create(:portfolio_skill, portfolio: portfolio, skill_label: "SQL", ai_level: 1, ai_confidence: "low")
      end
      Current.using(tenant_id: org.id) do
        skill.build_assessor_override(ai_level: 1, override_level: 5, overridden_by: 1, overridden_at: Time.current).save!
      end

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Strong across the board, especially SQL."
      )
    end

    it "gives a consistent-performance sentence when nothing is strong or concerning" do
      Current.using(tenant_id: org.id) { create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 3) }

      portfolio.recompute_verdict!

      expect(portfolio.reload.verdict_summary).to eq(
        "Solid, consistent performance across everything assessed."
      )
    end
  end
end
