# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::RatingParser do
  describe '.level' do
    {
      3      => 3,
      1      => 1,
      5      => 5,
      3.0    => 3,
      '3'    => 3,
      'L3'   => 3,
      'l3'   => 3,
      ' L3 ' => 3,
      'L 3'  => 3,
      '3.0'  => 3
    }.each do |input, expected|
      it "reads #{input.inspect} as #{expected}" do
        expect(described_class.level(input)).to eq(expected)
      end
    end

    # The old parser turned every one of these into L1 via to_i.clamp(1, 5).
    [nil, '', 'N/A', 'not_assessed', 'null', 0, 6, -1, '0', 'L6', 3.7, '3.7', 'L3+', '3-4', 'three', true, [], {}, Float::NAN, Float::INFINITY].each do |input|
      it "treats #{input.inspect} as not assessed" do
        expect(described_class.level(input)).to be_nil
      end
    end
  end

  describe '.confidence' do
    it 'accepts known values case-insensitively' do
      expect(described_class.confidence('High')).to eq('high')
      expect(described_class.confidence(' MEDIUM ')).to eq('medium')
      expect(described_class.confidence(:low)).to eq('low')
    end

    it 'falls back to low for anything unrecognised, never to high' do
      expect(described_class.confidence('very high')).to eq('low')
      expect(described_class.confidence(nil)).to eq('low')
      expect(described_class.confidence(0.9)).to eq('low')
    end
  end
end
