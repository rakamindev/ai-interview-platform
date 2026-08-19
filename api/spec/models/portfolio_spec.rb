require "rails_helper"

RSpec.describe Portfolio, type: :model do
  describe "#missing_configured_skills" do
    let(:organization) { create(:organization) }
    let(:assessment)   { create(:assessment, organization: organization) }
    let(:session)      { create(:session, assessment: assessment) }

    let!(:rated_skill)   { create(:assessment_skill, assessment: assessment, skill_id: "sk-1", skill_label: "React") }
    let!(:dropped_skill) { create(:assessment_skill, assessment: assessment, skill_id: "sk-2", skill_label: "SQL") }

    context "when the portfolio is complete" do
      let(:portfolio) { create(:portfolio, session: session, generation_status: "complete") }

      it "returns configured skills Gemini never returned a rating for" do
        create(:portfolio_skill, portfolio: portfolio, skill_id: "sk-1", skill_label: "React", is_discovered: false)

        expect(portfolio.missing_configured_skills).to contain_exactly(dropped_skill)
      end

      it "matches custom skills (no skill_id) by label" do
        custom = create(:assessment_skill, assessment: assessment, skill_id: nil, skill_label: "Bespoke Skill", is_custom: true)
        create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: "Bespoke Skill", is_discovered: false)

        expect(portfolio.missing_configured_skills).not_to include(custom)
      end

      it "returns none when every configured skill was rated" do
        create(:portfolio_skill, portfolio: portfolio, skill_id: "sk-1", skill_label: "React", is_discovered: false)
        create(:portfolio_skill, portfolio: portfolio, skill_id: "sk-2", skill_label: "SQL", is_discovered: false)

        expect(portfolio.missing_configured_skills).to be_empty
      end

      it "ignores discovered skills when matching (they are not configured)" do
        create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: "React", is_discovered: true)

        expect(portfolio.missing_configured_skills).to include(rated_skill)
      end
    end

    context "when the portfolio is still generating" do
      let(:portfolio) { create(:portfolio, session: session, generation_status: "generating") }

      it "returns none — nothing to reconcile until generation finishes" do
        expect(portfolio.missing_configured_skills).to be_empty
      end
    end
  end
end
