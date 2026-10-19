# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/portfolios/rating_normalizer'

RSpec.describe Portfolios::RatingNormalizer do
  def rate(level, confidence = 'high')
    described_class.call(level: level, confidence: confidence)
  end

  it 'accepts an integer level inside the anchor scale' do
    result = rate(3, 'medium')

    expect(result.persistable).to be true
    expect(result.level).to eq(3)
    expect(result.confidence).to eq('medium')
  end

  it 'accepts an L-prefixed level' do
    result = rate('L4', 'LOW')

    expect(result.level).to eq(4)
    expect(result.confidence).to eq('low')
  end

  it 'does not turn a missing level into L1' do
    result = rate(nil, 'high')

    expect(result.persistable).to be false
    expect(result.level).to be_nil
    expect(result.rejection_reason).to eq('invalid_level')
  end

  it 'rejects blank, zero, out-of-range, and non-numeric levels' do
    [0, 6, '', ' ', 'none', 'L0', 'L6', 'high', 1.5, Float::NAN].each do |level|
      result = rate(level, 'high')
      expect(result.persistable).to be(false), "expected #{level.inspect} to be rejected"
      expect(result.level).not_to eq(1)
    end
  end

  it 'rejects an unknown confidence instead of inventing one' do
    result = rate(2, 'certain')

    expect(result.persistable).to be false
    expect(result.rejection_reason).to eq('invalid_confidence')
  end
end
