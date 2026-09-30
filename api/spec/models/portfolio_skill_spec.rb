# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'assessed flag integrity' do
    it 'requires level and confidence for assessed skills' do
      skill = build(:portfolio_skill, ai_level: nil, ai_confidence: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
      expect(skill.errors[:ai_confidence]).to be_present
    end

    it 'allows unassessed skills to have nil level and confidence' do
      skill = build(:portfolio_skill, :unassessed)
      expect(skill).to be_valid
      expect(skill.ai_level).to be_nil
      expect(skill.ai_confidence).to be_nil
      expect(skill).not_to be_assessed
    end

    it 'rejects out-of-range levels' do
      skill = build(:portfolio_skill, ai_level: 0)
      expect(skill).not_to be_valid

      skill = build(:portfolio_skill, ai_level: 6)
      expect(skill).not_to be_valid
    end
  end
end
