# frozen_string_literal: true

require 'rails_helper'

# Holds the last N seconds of candidate audio so it can be replayed to Gemini
# after a reconnect. Capacity is in bytes: 32,000 per second of 16 kHz mono PCM.
RSpec.describe AudioRingBuffer do
  let(:one_second) { "\x00".b * AudioRingBuffer::BYTES_PER_SECOND }

  it 'keeps chunks in order and reports their size' do
    buffer = described_class.new(capacity_seconds: 5)

    buffer.push('ab'.b, timestamp: 1.0)
    buffer.push('cde'.b, timestamp: 2.0)

    expect(buffer.count).to eq(2)
    expect(buffer.size).to eq(5)
    expect(buffer.since(0).map(&:data)).to eq(%w[ab cde])
  end

  it 'evicts the oldest audio once it holds more than its capacity' do
    buffer = described_class.new(capacity_seconds: 2)

    3.times { |i| buffer.push(one_second, timestamp: i.to_f) }

    expect(buffer.count).to eq(2)
    expect(buffer.size).to eq(2 * AudioRingBuffer::BYTES_PER_SECOND)
    expect(buffer.since(0).map(&:timestamp)).to eq([1.0, 2.0])
  end

  it 'drops a single chunk larger than the whole capacity' do
    buffer = described_class.new(capacity_seconds: 1)

    buffer.push(one_second * 2, timestamp: 0.0)

    expect(buffer.count).to eq(0)
    expect(buffer.size).to eq(0)
  end

  it 'returns only the chunks at or after a point in time' do
    buffer = described_class.new
    [1.0, 2.0, 3.0].each { |t| buffer.push('x'.b, timestamp: t) }

    expect(buffer.since(2.0).map(&:timestamp)).to eq([2.0, 3.0])
    expect(buffer.since(9.0)).to be_empty
  end

  it 'stores a frozen copy, so later changes to the caller’s bytes don’t alter the replay' do
    buffer = described_class.new
    bytes = +'abc'

    buffer.push(bytes, timestamp: 0.0)
    bytes << 'zzz'

    expect(buffer.since(0).sole.data).to eq('abc')
    expect(buffer.since(0).sole.data).to be_frozen
  end

  it 'empties completely on clear' do
    buffer = described_class.new
    buffer.push('abc'.b, timestamp: 0.0)

    buffer.clear

    expect([buffer.count, buffer.size]).to eq([0, 0])
  end
end
