# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  describe 'validations' do
    it 'requires a skill label' do
      skill = build(:portfolio_skill, skill_label: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:skill_label]).to be_present
    end

    it 'requires a competency summary' do
      skill = build(:portfolio_skill, competency_summary: nil)
      expect(skill).not_to be_valid
    end

    it 'accepts only the confidence values the rubric defines' do
      %w[high medium low].each do |level|
        expect(build(:portfolio_skill, ai_confidence: level)).to be_valid
      end

      skill = build(:portfolio_skill, ai_confidence: 'very_high')
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_confidence]).to be_present
    end

    it 'accepts every level in 1..5 and nothing outside it' do
      (1..5).each do |level|
        expect(build(:portfolio_skill, ai_level: level)).to be_valid
      end

      expect(build(:portfolio_skill, ai_level: 0)).not_to be_valid
      expect(build(:portfolio_skill, ai_level: 6)).not_to be_valid
    end

    it 'rejects a non-integer level' do
      expect(build(:portfolio_skill, ai_level: 3.5)).not_to be_valid
    end
  end

  describe '#evidence_quotes' do
    it 'returns the stored array' do
      skill = build(:portfolio_skill, evidence: %w[first second])
      expect(skill.evidence_quotes).to eq(%w[first second])
    end

    it 'returns an empty array when the column holds nil' do
      skill = build(:portfolio_skill)
      skill[:evidence] = nil
      expect(skill.evidence_quotes).to eq([])
    end
  end

  describe 'assessor overrides' do
    it 'is destroyed along with the skill' do
      skill = create(:portfolio_skill)
      create(:assessor_override, portfolio_skill: skill)

      expect { skill.destroy }.to change(AssessorOverride, :count).by(-1)
    end

    it 'stays attached while the skill exists' do
      skill = create(:portfolio_skill)
      create(:assessor_override, portfolio_skill: skill)

      expect(skill.assessor_override).to be_present
    end
  end
end
