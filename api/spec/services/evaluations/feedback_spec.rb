# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Evaluations::Feedback do
  let(:assessment) { create(:assessment, name: 'Product Manager') }
  let(:session) { create(:session, assessment:, tenant_id: assessment.tenant_id) }
  let(:portfolio) { create(:portfolio, session:) }

  describe '#call' do
    it 'never leaks raw levels or override notes' do
      create(:portfolio_skill, portfolio:, ai_level: 4, ai_confidence: 'high', evidence: ['Q'])
      create(:portfolio_skill, portfolio:, skill_label: 'Execution', ai_level: 3, ai_confidence: 'low', evidence: ['Q'])

      output = described_class.new(portfolio).call.to_json

      expect(output).not_to include('ai_level')
      expect(output).not_to include('override')
      expect(output).not_to include('confidence')
    end

    it 'lists fully-assessed skills as strengths' do
      create(:portfolio_skill, portfolio:, skill_label: 'Strategy', ai_level: 4, ai_confidence: 'high', evidence: ['Q'])

      output = described_class.new(portfolio).call

      expect(output[:strengths]).to eq(['Strategy'])
      expect(output[:growth_areas]).to be_empty
    end

    it 'lists low-confidence and empty-evidence skills as growth areas' do
      create(:portfolio_skill, portfolio:, skill_label: 'Partial', ai_level: 3, ai_confidence: 'low', evidence: ['Q'])
      create(:portfolio_skill, portfolio:, skill_label: 'Unseen', ai_level: 3, ai_confidence: 'high', evidence: [])

      output = described_class.new(portfolio).call

      expect(output[:growth_areas]).to contain_exactly('Partial', 'Unseen')
    end

    it 'reports coverage in a non-scoring shape' do
      create(:portfolio_skill, portfolio:, ai_level: 4, ai_confidence: 'high', evidence: ['Q'])

      output = described_class.new(portfolio).call

      expect(output[:coverage]).to include(assessed: 1, total: 1, percent: 100)
    end

    it 'handles an empty portfolio gracefully' do
      output = described_class.new(portfolio).call

      expect(output[:strengths]).to be_empty
      expect(output[:overall]).to include('Thank you')
    end

    it 'does not leak assessor override notes' do
      skill = create(:portfolio_skill, portfolio:, ai_level: 3, ai_confidence: 'high', evidence: ['Q'])
      create(:assessor_override, portfolio_skill: skill, override_level: 5, assessor_notes: 'internal: strong hire')

      output = described_class.new(portfolio).call.to_json

      expect(output).not_to include('internal: strong hire')
      expect(output).not_to include('override_level')
    end
  end
end
