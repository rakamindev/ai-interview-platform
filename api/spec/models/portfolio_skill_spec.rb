# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioSkill, type: :model do
  describe "status: rated (default)" do
    it "is valid with a level, confidence, and summary" do
      skill = build(:portfolio_skill)
      expect(skill).to be_valid
    end

    it "requires ai_level to be present" do
      skill = build(:portfolio_skill, ai_level: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end

    it "requires ai_confidence to be present" do
      skill = build(:portfolio_skill, ai_confidence: nil)
      expect(skill).not_to be_valid
    end

    it "requires competency_summary to be present" do
      skill = build(:portfolio_skill, competency_summary: nil)
      expect(skill).not_to be_valid
    end
  end

  describe "status: not_assessed" do
    it "is valid with ai_level, ai_confidence, and competency_summary all nil" do
      skill = build(:portfolio_skill, :not_assessed)
      expect(skill).to be_valid
    end

    it "rejects an ai_level being set on a not_assessed skill" do
      skill = build(:portfolio_skill, :not_assessed, ai_level: 3)
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end
  end

  describe "#not_assessed?" do
    it "is true when status is not_assessed" do
      expect(build(:portfolio_skill, :not_assessed).not_assessed?).to be true
    end

    it "is false when status is rated" do
      expect(build(:portfolio_skill).not_assessed?).to be false
    end
  end
end
