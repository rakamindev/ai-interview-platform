# frozen_string_literal: true

# This spec exercises the snapshot builder without requiring a database-backed
# Rails test environment.
unless defined?(ApplicationRecord)
  class ApplicationRecord
    class << self
      def belongs_to(*); end
      def validates(*); end
      def scope(*); end
    end
  end
end

require_relative '../../app/models/portfolio_revision'

RSpec.describe PortfolioRevision do
  it 'captures an immutable, versioned snapshot of skills and overrides' do
    generated_at = Time.utc(2026, 10, 25, 1, 0, 0)
    skill = double(
      'PortfolioSkill',
      id: 11,
      skill_id: 'react',
      skill_label: 'React',
      is_discovered: false,
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['I led a React migration.'],
      competency_summary: 'Led a frontend migration.'
    )
    override = double(
      'AssessorOverride',
      id: 21,
      portfolio_skill_id: 11,
      ai_level: 3,
      override_level: 4,
      assessor_notes: 'Confirmed during review.',
      overridden_by: 'assessor@example.com',
      overridden_at: generated_at
    )
    portfolio = double(
      'Portfolio',
      id: 7,
      generation_status: 'complete',
      generated_at: generated_at,
      generation_error: nil,
      portfolio_skills: [skill],
      assessor_overrides: [override]
    )

    allow(PortfolioRevision).to receive(:where).with(portfolio_id: 7).and_return(double(maximum: 3))

    expect(PortfolioRevision).to receive(:create!).with(
      portfolio: portfolio,
      version: 4,
      generation_status: 'complete',
      generated_at: generated_at,
      generation_error: nil,
      snapshot: {
        skills: [
          {
            id: 11,
            skill_id: 'react',
            skill_label: 'React',
            is_discovered: false,
            ai_level: 3,
            ai_confidence: 'high',
            evidence: ['I led a React migration.'],
            competency_summary: 'Led a frontend migration.'
          }
        ],
        overrides: [
          {
            id: 21,
            portfolio_skill_id: 11,
            ai_level: 3,
            override_level: 4,
            assessor_notes: 'Confirmed during review.',
            overridden_by: 'assessor@example.com',
            overridden_at: generated_at
          }
        ]
      }
    ).and_return(:revision)

    expect(described_class.capture!(portfolio)).to eq(:revision)
  end

  it 'starts at version one and captures empty collections for a portfolio without skills' do
    portfolio = double(
      'Portfolio',
      id: 8,
      generation_status: 'complete',
      generated_at: nil,
      generation_error: nil,
      portfolio_skills: [],
      assessor_overrides: []
    )

    allow(PortfolioRevision).to receive(:where).with(portfolio_id: 8).and_return(double(maximum: nil))

    expect(PortfolioRevision).to receive(:create!).with(
      portfolio: portfolio,
      version: 1,
      generation_status: 'complete',
      generated_at: nil,
      generation_error: nil,
      snapshot: { skills: [], overrides: [] }
    ).and_return(:revision)

    expect(described_class.capture!(portfolio)).to eq(:revision)
  end
end
