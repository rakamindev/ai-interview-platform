# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioRingBuffer do
  subject(:buffer) { described_class.new(capacity_seconds: 1) } # 32KB capacity

  describe '#push / #since' do
    it 'returns chunks newer than the given timestamp in insertion order' do
      buffer.push('a' * 100, timestamp: 1.0)
      buffer.push('b' * 100, timestamp: 2.0)
      buffer.push('c' * 100, timestamp: 3.0)

      expect(buffer.since(2.0).map(&:data)).to eq(['b' * 100, 'c' * 100])
    end

    it 'evicts oldest chunks beyond byte capacity' do
      buffer.push('x' * 20_000, timestamp: 1.0)
      buffer.push('y' * 20_000, timestamp: 2.0)

      expect(buffer.size).to be <= described_class::BYTES_PER_SECOND
      expect(buffer.since(2.0).map(&:data)).to eq(['y' * 20_000])
    end
  end

  describe '#clear' do
    it 'empties the buffer' do
      buffer.push('z' * 10, timestamp: 1.0)
      buffer.clear

      expect(buffer.count).to eq(0)
      expect(buffer.size).to eq(0)
    end
  end
end
