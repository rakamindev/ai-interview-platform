# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/fit_gap/readiness'

RSpec.describe FitGap::Readiness do
  def row(label, result, confidence = 'high')
    { 'skill_label' => label, 'result' => result, 'confidence' => confidence }
  end

  it 'holds when a required skill was never assessed, even if another skill matches' do
    decision = described_class.call([row('React', 'match'), row('SQL', 'not_assessed')])

    expect(decision['verdict']).to eq('hold')
    expect(decision['blocking_skills']).to eq(['SQL'])
    expect(decision['counts']['not_assessed']).to eq(1)
  end

  it 'holds on low confidence instead of advancing a thin rating' do
    decision = described_class.call([row('React', 'exceed', 'low')])

    expect(decision['verdict']).to eq('hold')
    expect(decision['low_confidence_skills']).to eq(['React'])
  end

  it 'declines a confident gap only after every required skill is assessed' do
    decision = described_class.call([row('React', 'match'), row('SQL', 'gap')])

    expect(decision['verdict']).to eq('decline')
    expect(decision['blocking_skills']).to eq(['SQL'])
  end

  it 'advances when every required skill meets the bar' do
    decision = described_class.call([row('React', 'match'), row('SQL', 'exceed', 'medium')])

    expect(decision['verdict']).to eq('advance')
    expect(decision['blocking_skills']).to eq([])
  end

  it 'holds when the vacancy has no skills to compare' do
    expect(described_class.call([])['verdict']).to eq('hold')
  end
end
