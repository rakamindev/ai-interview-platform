# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  describe '#build_skill_comparisons' do
    it 'menghasilkan gap -4 ketika candidate L1 dan required L5' do
      vacancy_skill = double(
        skill_id: 101,
        skill_label: 'Frontend Development',
        expected_level: 5
      )

      vacancy = double(
        vacancy_skills: [vacancy_skill]
      )

      portfolio = double

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: double
      )

      allow(engine)
        .to receive(:effective_portfolio_skills)
        .and_return(
          [
            {
              id: 1,
              skill_id: 101,
              skill_label: 'Frontend Development',
              ai_level: 1,
              effective_level: 1,
              confidence: 0.9,
              overridden: false
            }
          ]
        )

      result = engine.send(:build_skill_comparisons)

      comparison = result.first

      expect(comparison[:skill_label]).to eq('Frontend Development')
      expect(comparison[:candidate_level]).to eq(1)
      expect(comparison[:expected_level]).to eq(5)
      expect(comparison[:result]).to eq('gap')
      expect(comparison[:delta]).to eq(-4)
    end
  end
end