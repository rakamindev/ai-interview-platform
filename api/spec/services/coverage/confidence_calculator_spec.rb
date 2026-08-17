# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::ConfidenceCalculator do
  # PRD-01 rules:
  #   high   — probe_count >= 3 AND state = covered
  #   medium — probe_count = 2 OR state = partial
  #   low    — probe_count <= 1 OR state = initiated
  it 'derives high for covered with probe_count >= 3' do
    expect(described_class.call(state: 'covered', probe_count: 3)).to eq('high')
    expect(described_class.call(state: 'covered', probe_count: 5)).to eq('high')
  end

  it 'derives medium for covered with probe_count 2' do
    expect(described_class.call(state: 'covered', probe_count: 2)).to eq('medium')
  end

  it 'derives medium for partial regardless of probe count' do
    expect(described_class.call(state: 'partial', probe_count: 2)).to eq('medium')
    expect(described_class.call(state: 'partial', probe_count: 5)).to eq('medium')
  end

  it 'derives medium for probe_count 2 regardless of state' do
    expect(described_class.call(state: 'initiated', probe_count: 2)).to eq('medium')
  end

  it 'derives low for initiated with probe_count 1' do
    expect(described_class.call(state: 'initiated', probe_count: 1)).to eq('low')
  end

  it 'derives low for probe_count <= 1' do
    expect(described_class.call(state: 'not_yet', probe_count: 0)).to eq('low')
    expect(described_class.call(state: 'covered', probe_count: 1)).to eq('low')
  end

  it 'derives low for unknown or missing coverage' do
    expect(described_class.call(state: nil, probe_count: nil)).to eq('low')
    expect(described_class.call(state: 'bogus', probe_count: 5)).to eq('low')
  end
end
