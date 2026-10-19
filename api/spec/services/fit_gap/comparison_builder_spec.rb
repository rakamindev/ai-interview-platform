# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/fit_gap/comparison_builder'

RSpec.describe FitGap::ComparisonBuilder do
  def build(vacancy_skills, portfolio_skills)
    described_class.build(vacancy_skills: vacancy_skills, portfolio_skills: portfolio_skills)
  end

  it 'matches on skill id before the label' do
    rows = build(
      [{ 'skill_id' => 'sk-1', 'skill_label' => 'React', 'expected_level' => 3 }],
      [{ 'skill_id' => 'sk-1', 'skill_label' => 'React.js', 'effective_level' => 4, 'confidence' => 'high', 'overridden' => false }]
    )

    expect(rows.first).to include(
      'result' => 'exceed',
      'delta' => 1,
      'required_level' => 3,
      'expected_level' => 3,
      'candidate_level' => 4
    )
  end

  it 'matches a trimmed label when the model and the vacancy disagree on case' do
    rows = build(
      [{ 'skill_label' => 'System Design', 'expected_level' => 3 }],
      [{ 'skill_label' => '  system design ', 'effective_level' => 3, 'confidence' => 'medium' }]
    )

    expect(rows.first['result']).to eq('match')
    expect(rows.first['delta']).to eq(0)
  end

  it 'does not subtract a missing candidate level' do
    rows = build(
      [{ 'skill_label' => 'SQL', 'expected_level' => 2 }],
      []
    )

    expect(rows.first).to include('result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil, 'evidence_status' => 'not_assessed')
  end

  it 'keeps an override visible and records a gap against the overridden level' do
    rows = build(
      [{ 'skill_id' => 'sk-2', 'skill_label' => 'SQL', 'expected_level' => 4 }],
      [{ 'skill_id' => 'sk-2', 'skill_label' => 'SQL', 'effective_level' => 2, 'confidence' => 'high', 'overridden' => true }]
    )

    expect(rows.first).to include('result' => 'gap', 'delta' => -2, 'is_override' => true)
  end

  it 'refuses to compare when the required level itself is unusable' do
    rows = build(
      [{ 'skill_label' => 'SQL', 'expected_level' => nil }],
      [{ 'skill_label' => 'SQL', 'effective_level' => 3, 'confidence' => 'high' }]
    )

    expect(rows.first['result']).to eq('not_assessed')
    expect(rows.first['evidence_status']).to eq('insufficient_evidence')
  end
end
