# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_label) }
    it { should validate_inclusion_of(:ai_confidence).in_array(PortfolioSkill::CONFIDENCE_LEVELS) }
    it { should validate_presence_of(:competency_summary) }

    it 'validates ai_level is between 1 and 5' do
      (1..5).each do |level|
        skill = build(:portfolio_skill, ai_level: level)
        expect(skill).to be_valid
      end

      [0, 6, -1].each do |level|
        skill = build(:portfolio_skill, ai_level: level)
        expect(skill).not_to be_valid
      end
    end
  end

  describe 'associations' do
    it { should belong_to(:portfolio) }
    it { should have_one(:assessor_override).dependent(:destroy) }
  end

  describe '#evidence_quotes' do
    it 'returns evidence as an array' do
      skill = build(:portfolio_skill, evidence: ['quote1', 'quote2'])
      expect(skill.evidence_quotes).to eq(['quote1', 'quote2'])
    end

    it 'returns empty array when evidence is nil' do
      skill = build(:portfolio_skill, evidence: nil)
      expect(skill.evidence_quotes).to eq([])
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:portfolio_skill)).to be_valid
    end

    it 'has a valid discovered trait' do
      expect(build(:portfolio_skill, :discovered)).to be_valid
    end
  end
end
