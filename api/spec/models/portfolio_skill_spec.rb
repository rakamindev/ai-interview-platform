# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'validations' do
    it 'validates presence of skill_label and competency_summary' do
      skill = PortfolioSkill.new
      expect(skill).not_to be_valid
      expect(skill.errors[:skill_label]).to be_present
      expect(skill.errors[:competency_summary]).to be_present
    end

    it 'validates ai_level is an integer between 1 and 5 (DEF-P2-02)' do
      skill = PortfolioSkill.new(skill_label: 'SQL', competency_summary: 'Proficient with queries')

      skill.ai_level = 0
      expect(skill).not_to be_valid

      skill.ai_level = 6
      expect(skill).not_to be_valid

      (1..5).each do |lvl|
        skill.ai_level = lvl
        skill.ai_confidence = 'high'
        skill.valid?
        expect(skill.errors[:ai_level]).to be_empty
      end
    end

    it 'validates ai_confidence is high, medium, or low' do
      skill = PortfolioSkill.new(skill_label: 'SQL', competency_summary: 'Good', ai_level: 3)

      skill.ai_confidence = 'super_high'
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_confidence]).to be_present

      %w[high medium low].each do |conf|
        skill.ai_confidence = conf
        skill.valid?
        expect(skill.errors[:ai_confidence]).to be_empty
      end
    end
  end

  describe '#evidence_quotes' do
    it 'returns empty array when evidence is nil' do
      skill = PortfolioSkill.new(evidence: nil)
      expect(skill.evidence_quotes).to eq([])
    end

    it 'wraps array of quotes correctly' do
      quotes = ['I managed the primary DB replica failover', 'We cut latency by 35%']
      skill = PortfolioSkill.new(evidence: quotes)
      expect(skill.evidence_quotes).to eq(quotes)
    end
  end
end
