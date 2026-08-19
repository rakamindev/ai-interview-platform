require 'rails_helper'

RSpec.describe AudioRingBuffer do
  subject(:buffer) { described_class.new(capacity_seconds: 1) } # 32,000 bytes capacity

  let(:bytes_per_second) { AudioRingBuffer::BYTES_PER_SECOND }

  describe '#initialize' do
    it 'sets correct capacity' do
      expect(buffer.size).to eq(0)
      expect(buffer.count).to eq(0)
    end
  end

  describe '#push' do
    let(:chunk1) { 'a' * 10_000 }
    let(:chunk2) { 'b' * 15_000 }
    let(:chunk3) { 'c' * 10_000 }

    it 'adds chunks and updates size' do
      buffer.push(chunk1)
      expect(buffer.size).to eq(10_000)
      expect(buffer.count).to eq(1)

      buffer.push(chunk2)
      expect(buffer.size).to eq(25_000)
      expect(buffer.count).to eq(2)
    end

    it 'evicts oldest chunks when capacity is exceeded' do
      buffer.push(chunk1)
      buffer.push(chunk2)
      buffer.push(chunk3) # Total would be 35_000 > 32_000

      expect(buffer.size).to eq(25_000) # 15_000 + 10_000
      expect(buffer.count).to eq(2)
      expect(buffer.since(0).map(&:data)).to eq([chunk2, chunk3])
    end

    it 'stores duplicates and freezes data' do
      data = 'hello'
      buffer.push(data)
      stored_data = buffer.since(0).first.data

      expect(stored_data).to eq(data)
      expect(stored_data).to be_frozen
      expect(stored_data.object_id).not_to eq(data.object_id)
    end
  end

  describe '#since' do
    let(:now) { Process.clock_gettime(Process::CLOCK_MONOTONIC) }

    before do
      buffer.push('a' * 100, timestamp: now - 5)
      buffer.push('b' * 100, timestamp: now - 3)
      buffer.push('c' * 100, timestamp: now - 1)
    end

    it 'returns chunks after or equal to the timestamp' do
      chunks = buffer.since(now - 3)
      expect(chunks.length).to eq(2)
      expect(chunks.map(&:data)).to eq(['b' * 100, 'c' * 100])
    end

    it 'returns all chunks for a very old timestamp' do
      chunks = buffer.since(now - 10)
      expect(chunks.length).to eq(3)
    end

    it 'returns no chunks for a future timestamp' do
      chunks = buffer.since(now + 10)
      expect(chunks).to be_empty
    end
  end

  describe '#clear' do
    it 'removes all chunks and resets size' do
      buffer.push('a' * 10_000)
      expect(buffer.size).to eq(10_000)
      
      buffer.clear
      
      expect(buffer.size).to eq(0)
      expect(buffer.count).to eq(0)
    end
  end
end
