# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioSkill, type: :model do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:record) { create(:portfolio_skill, portfolio: portfolio) }
  let(:expected_tenant_id) { organization.id }

  include_examples "a tenant scoped child model"

  describe "status" do
    it "is valid as assessed with a level and confidence" do
      skill = build(:portfolio_skill, portfolio: portfolio, status: "assessed", ai_level: 4, ai_confidence: "high")
      expect(skill).to be_valid
    end

    it "is valid as not_assessed with no level or confidence" do
      skill = build(:portfolio_skill, :not_assessed, portfolio: portfolio)
      expect(skill).to be_valid
    end

    it "is valid as unparseable with no level or confidence" do
      skill = build(:portfolio_skill, :unparseable, portfolio: portfolio)
      expect(skill).to be_valid
    end

    it "requires a valid ai_level only when assessed" do
      skill = build(:portfolio_skill, portfolio: portfolio, status: "assessed", ai_level: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).not_to be_empty
    end

    it "rejects an unknown status" do
      skill = build(:portfolio_skill, portfolio: portfolio, status: "bogus")
      expect(skill).not_to be_valid
    end
  end

  describe "#assessed?, #not_assessed?, #unparseable?" do
    it "reflects the status column" do
      expect(build(:portfolio_skill, status: "assessed")).to be_assessed
      expect(build(:portfolio_skill, :not_assessed)).to be_not_assessed
      expect(build(:portfolio_skill, :unparseable)).to be_unparseable
    end
  end
end
