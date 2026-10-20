# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  describe 'not assessed' do
    it 'is valid with no level, no confidence and no summary' do
      skill = build(:portfolio_skill, :not_assessed)

      expect(skill).to be_valid
      expect(skill).not_to be_assessed
    end

    it 'persists through the database constraints' do
      skill = create(:portfolio_skill, :not_assessed)

      expect(skill.reload.ai_level).to be_nil
    end
  end

  describe 'half-set ratings' do
    it 'rejects a level without a confidence' do
      skill = build(:portfolio_skill, ai_level: 3, ai_confidence: nil)

      expect(skill).not_to be_valid
    end

    it 'rejects a confidence without a level' do
      skill = build(:portfolio_skill, ai_level: nil, ai_confidence: 'low')

      expect(skill).not_to be_valid
    end

    it 'is also rejected by the database when validations are bypassed' do
      skill = create(:portfolio_skill)

      expect { skill.update_column(:ai_confidence, nil) }
        .to raise_error(ActiveRecord::StatementInvalid, /chk_portfolio_skills_rating_complete/)
    end
  end

  it 'still requires a summary when the skill was assessed' do
    expect(build(:portfolio_skill, competency_summary: nil)).not_to be_valid
  end

  it 'rejects levels outside 1..5' do
    expect(build(:portfolio_skill, ai_level: 0)).not_to be_valid
    expect(build(:portfolio_skill, ai_level: 6)).not_to be_valid
  end

  describe '#effective_level' do
    it 'prefers the assessor override, including over a not-assessed AI rating' do
      skill = create(:portfolio_skill, :not_assessed)
      create(:assessor_override, portfolio_skill: skill, ai_level: nil, override_level: 2)

      expect(skill.reload.effective_level).to eq(2)
    end

    it 'falls back to the AI level' do
      expect(build(:portfolio_skill, ai_level: 4).effective_level).to eq(4)
    end
  end
end
