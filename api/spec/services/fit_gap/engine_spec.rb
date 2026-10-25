# frozen_string_literal: true

require 'active_support/core_ext/enumerable'
require_relative '../../../app/services/fit_gap/engine'

RSpec.describe FitGap::Engine do
  let(:portfolio) { double('Portfolio', id: 7) }
  let(:vacancy) { double('Vacancy', id: 3) }
  let(:gemini_client) { double('GeminiClient') }
  let(:revision) do
    double(
      'PortfolioRevision',
      id: 12,
      snapshot: {
        'skills' => [
          {
            'id' => 11,
            'skill_id' => 'react',
            'skill_label' => 'React',
            'ai_level' => 2,
            'ai_confidence' => 'medium'
          }
        ],
        'overrides' => [
          {
            'portfolio_skill_id' => 11,
            'override_level' => 4
          }
        ]
      }
    )
  end

  it 'uses the selected revision snapshot and preserves its assessor override' do
    engine = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      portfolio_revision: revision,
      gemini_client: gemini_client
    )

    expect(engine.send(:effective_portfolio_skills)).to contain_exactly(
      id: 11,
      skill_id: 'react',
      skill_label: 'React',
      ai_level: 2,
      effective_level: 4,
      confidence: 'medium',
      overridden: true
    )
  end

  it 'does not treat a snapshot override equal to the AI level as an override' do
    revision = double(
      'PortfolioRevision',
      id: 13,
      snapshot: {
        'skills' => [
          {
            'id' => 11,
            'skill_id' => 'react',
            'skill_label' => 'React',
            'ai_level' => 2,
            'ai_confidence' => 'medium'
          }
        ],
        'overrides' => [
          {
            'portfolio_skill_id' => 11,
            'override_level' => 2
          }
        ]
      }
    )

    engine = described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      portfolio_revision: revision,
      gemini_client: gemini_client
    )

    expect(engine.send(:effective_portfolio_skills)).to contain_exactly(
      id: 11,
      skill_id: 'react',
      skill_label: 'React',
      ai_level: 2,
      effective_level: 2,
      confidence: 'medium',
      overridden: false
    )
  end
end
