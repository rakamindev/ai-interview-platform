# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'validations and unassessed skills' do
    it 'is valid with a valid ai_level (1-5)' do
      skill = PortfolioSkill.new(
        skill_label: 'React Core',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Demonstrated solid proficiency.'
      )
      expect(skill.errors[:ai_level]).to be_empty
    end

    it 'is valid with a nil ai_level (unassessed skill - UU PDP compliance)' do
      skill = PortfolioSkill.new(
        skill_label: 'Kubernetes',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Skill was not covered during this interview session.'
      )
      skill.validate
      expect(skill.errors[:ai_level]).to be_empty
      expect(skill.unassessed?).to be true
    end

    it 'is invalid if ai_level is out of 1-5 range' do
      skill = PortfolioSkill.new(ai_level: 6)
      skill.validate
      expect(skill.errors[:ai_level]).to be_present

      skill_zero = PortfolioSkill.new(ai_level: 0)
      skill_zero.validate
      expect(skill_zero.errors[:ai_level]).to be_present
    end

    it 'validates ai_confidence inclusion when present' do
      skill_invalid = PortfolioSkill.new(ai_confidence: 'extreme')
      skill_invalid.validate
      expect(skill_invalid.errors[:ai_confidence]).to be_present

      skill_valid = PortfolioSkill.new(ai_confidence: 'medium')
      skill_valid.validate
      expect(skill_valid.errors[:ai_confidence]).to be_empty
    end
  end

  describe '#effective_level' do
    it 'returns ai_level when no assessor override exists' do
      skill = PortfolioSkill.new(ai_level: 3)
      expect(skill.effective_level).to eq(3)
    end

    it 'returns override_level when assessor override exists' do
      skill = PortfolioSkill.new(ai_level: 2)
      override = AssessorOverride.new(override_level: 4)
      allow(skill).to receive(:assessor_override).and_return(override)

      expect(skill.effective_level).to eq(4)
    end

    it 'returns nil when unassessed and no override exists' do
      skill = PortfolioSkill.new(ai_level: nil)
      expect(skill.effective_level).to be_nil
    end
  end
end

