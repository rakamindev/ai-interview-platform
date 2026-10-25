# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioRingBuffer do
  subject(:buffer) { described_class.new(capacity_seconds: 1) } # 32,000 bytes capacity

  describe '#push and eviction' do
    it 'stores audio frames and tracks total byte size and count' do
      chunk1 = 'A' * 1000
      chunk2 = 'B' * 2000

      buffer.push(chunk1, timestamp: 10.0)
      buffer.push(chunk2, timestamp: 11.0)

      expect(buffer.size).to eq(3000)
      expect(buffer.count).to eq(2)
    end

    it 'automatically evicts oldest frames when total bytes exceed capacity' do
      # Capacity is 1 second = 32,000 bytes
      chunk_a = 'A' * 20_000
      chunk_b = 'B' * 20_000

      buffer.push(chunk_a, timestamp: 1.0)
      buffer.push(chunk_b, timestamp: 2.0)

      # chunk_a should be evicted
      expect(buffer.size).to eq(20_000)
      expect(buffer.count).to eq(1)

      remaining = buffer.since(0.0)
      expect(remaining.first.data).to eq(chunk_b)
    end
  end

  describe '#since' do
    it 'returns chunks with timestamp >= given timestamp in chronological order' do
      buffer.push('first', timestamp: 100.0)
      buffer.push('second', timestamp: 105.0)
      buffer.push('third', timestamp: 110.0)

      chunks = buffer.since(105.0)
      expect(chunks.map(&:data)).to eq(%w[second third])
    end
  end

  describe '#clear' do
    it 'resets chunks and byte count' do
      buffer.push('sample', timestamp: 1.0)
      buffer.clear

      expect(buffer.size).to eq(0)
      expect(buffer.count).to eq(0)
      expect(buffer.since(0.0)).to be_empty
    end
  end
end
