# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:portfolio) { create(:portfolio) }

  subject(:skill) do
    described_class.new(
      portfolio: portfolio,
      skill_label: 'Database Indexing',
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['Explaining b-tree vs hash indexes.'],
      competency_summary: 'Understands index design tradeoffs.'
    )
  end

  describe 'validations' do
    it 'is valid with valid attributes' do
      expect(skill).to be_valid
    end

    it 'requires skill_label' do
      skill.skill_label = nil
      expect(skill).not_to be_valid
    end

    it 'validates ai_level is an integer between 1 and 5' do
      skill.ai_level = 0
      expect(skill).not_to be_valid

      skill.ai_level = 6
      expect(skill).not_to be_valid

      skill.ai_level = 4
      expect(skill).to be_valid
    end

    it 'validates ai_confidence is in high, medium, low' do
      skill.ai_confidence = 'unknown'
      expect(skill).not_to be_valid

      %w[high medium low].each do |valid_conf|
        skill.ai_confidence = valid_conf
        expect(skill).to be_valid
      end
    end

    it 'requires competency_summary' do
      skill.competency_summary = nil
      expect(skill).not_to be_valid
    end
  end

  describe '#evidence_quotes' do
    it 'returns an array of quote strings' do
      expect(skill.evidence_quotes).to eq(['Explaining b-tree vs hash indexes.'])
    end

    it 'handles nil evidence gracefully' do
      skill.evidence = nil
      expect(skill.evidence_quotes).to eq([])
    end
  end
end
