# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::HonestySentence do
  let(:summary) do
    { total_skills: 5, assessed: 2, thin_evidence: 1, not_assessed: 2, unavailable: 0,
      turns: 64, duration_seconds: 2280, end_reason: 'all_covered' }
  end

  it 'says how many skills the report covers, how the interview went, and what was captured' do
    expect(described_class.new(summary).sentence)
      .to eq('This report covers 3 of 5 skills. The interview ran 38 minutes and ended normally. 64 turns were captured.')
  end

  it 'says when the interview ended early, and why' do
    short = summary.merge(duration_seconds: 8, end_reason: 'error', turns: 1)

    expect(described_class.new(short).sentence)
      .to include('ran 8 seconds and ended early (a connection error on our side). 1 turn was captured.')
  end

  it 'hides zero counts, except "not assessed", whose absence would be a claim too' do
    expect(described_class.new(summary).counts).to eq('2 assessed · 1 needs a human look · 2 not assessed')
    expect(described_class.new(summary.merge(not_assessed: 0)).counts).to include('0 not assessed')
  end
end
