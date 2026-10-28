# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:assessment) do
    Assessment.create!(tenant_id: 1, created_by: 1, name: 'Frontend Engineer', time_limit_min: 30)
  end
  let(:interview_session) { Session.create!(tenant_id: 1, assessment: assessment, duration_seconds: 1560) }
  let(:portfolio) do
    interview_session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
  end
  let!(:typescript) do
    portfolio.portfolio_skills.create!(
      skill_label: 'TypeScript', ai_level: 2, ai_confidence: 'medium',
      evidence: ['I typed the API responses with discriminated unions.'], competency_summary: 'Summary.'
    )
  end

  it 'exports a portfolio without overrides' do
    expect(described_class.new(portfolio: portfolio).call).to start_with('%PDF')
  end

  # The built-in PDF fonts only cover Windows-1252. The override line used to contain an arrow
  # outside that set, so every portfolio an assessor had corrected failed to export (HTTP 500).
  it 'exports a portfolio whose level an assessor overrode' do
    AssessorOverride.create!(
      portfolio_skill: typescript, ai_level: 2, override_level: 3, overridden_by: 1,
      assessor_notes: 'Raised after reviewing the evidence.'
    )

    expect(described_class.new(portfolio: portfolio.reload).call).to start_with('%PDF')
  end
end
