# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/fit_gap/summary'

RSpec.describe FitGap::Summary do
  it 'marks complete, high-confidence matches as low risk' do
    summary = described_class.new(
      [
        { skill_label: 'React', result: 'match', candidate_level: 3, required_level: 3, delta: 0, confidence: 'high' },
        { skill_label: 'SQL', result: 'exceed', candidate_level: 4, required_level: 3, delta: 1, confidence: 'medium' }
      ]
    ).call

    expect(summary[:readiness_score]).to eq(100)
    expect(summary[:risk_level]).to eq('low')
    expect(summary[:flags]).to be_empty
  end

  it 'flags missing and critical skill evidence as high risk' do
    summary = described_class.new(
      [
        { skill_label: 'React', result: 'gap', candidate_level: 1, required_level: 3, delta: -2, confidence: 'low' },
        { skill_label: 'System Design', result: 'not_assessed', candidate_level: nil, required_level: 4, delta: nil }
      ]
    ).call

    expect(summary[:risk_level]).to eq('high')
    expect(summary[:critical_gap_count]).to eq(1)
    expect(summary[:not_assessed_count]).to eq(1)
    expect(summary[:flags]).to include('1 required skill(s) not assessed')
    expect(summary[:flags]).to include('1 critical gap(s) of two or more levels')
  end

  it 'keeps human overrides visible to reviewers' do
    summary = described_class.new(
      [
        { skill_label: 'Communication', result: 'match', candidate_level: 3, required_level: 3, delta: 0, is_override: true }
      ]
    ).call

    expect(summary[:override_count]).to eq(1)
    expect(summary[:flags]).to include('1 human override(s) applied')
  end
end
