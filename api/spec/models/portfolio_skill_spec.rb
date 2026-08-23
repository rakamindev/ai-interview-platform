# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:portfolio) }
    it { is_expected.to have_one(:assessor_override).dependent(:destroy) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_label) }
    it { is_expected.to validate_numericality_of(:ai_level).only_integer.is_in(1..5) }
    it { is_expected.to validate_inclusion_of(:ai_confidence).in_array(%w[high medium low]) }
    it { is_expected.to validate_presence_of(:competency_summary) }
  end

  describe '#evidence_quotes' do
    it 'returns evidence as an array' do
      skill = build(:portfolio_skill, evidence: ['Quote 1', 'Quote 2'])
      expect(skill.evidence_quotes).to eq(['Quote 1', 'Quote 2'])
    end

    it 'returns empty array when evidence is nil' do
      skill = build(:portfolio_skill, evidence: nil)
      expect(skill.evidence_quotes).to eq([])
    end

    it 'wraps single string in array' do
      skill = build(:portfolio_skill, evidence: 'Single quote')
      expect(skill.evidence_quotes).to eq(['Single quote'])
    end
  end

  describe 'constants' do
    it 'defines CONFIDENCE_LEVELS' do
      expect(PortfolioSkill::CONFIDENCE_LEVELS).to eq(%w[high medium low])
    end
  end
end
