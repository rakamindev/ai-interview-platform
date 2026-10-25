# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::ConnectionLease do
  let(:session_id) { 9_000_000 + SecureRandom.random_number(100_000) }
  let(:lease) { described_class.new(session_id) }

  before { lease.delete! }
  after { lease.delete! }

  it 'allows exactly one initial owner' do
    first = lease.acquire(connection_id: 'tab-a', initial_turn: 4)
    second = lease.acquire(connection_id: 'tab-b', initial_turn: 4)

    expect(first.status).to eq(:acquired)
    expect(first.generation).to eq(1)
    expect(second.status).to eq(:in_use)
    expect(second.owner_connection_id).to eq('tab-a')
    expect(lease.authoritative?(connection_id: 'tab-a', generation: 1)).to be(true)
    expect(lease.authoritative?(connection_id: 'tab-b', generation: 1)).to be(false)
  end

  it 'resumes a disconnected lease with a new generation and invalidates the old owner' do
    first = lease.acquire(connection_id: 'tab-a', initial_turn: 2)
    expect(lease.disconnect(connection_id: 'tab-a', generation: first.generation)).to be(true)

    resumed = lease.acquire(connection_id: 'tab-b', initial_turn: 2)

    expect(resumed.status).to eq(:resumed)
    expect(resumed.generation).to eq(2)
    expect(
      lease.authoritative?(connection_id: 'tab-a', generation: 1, state: 'disconnected_grace')
    ).to be(false)
    expect(lease.authoritative?(connection_id: 'tab-b', generation: 2)).to be(true)
  end

  it 'advances the generation for an explicit takeover' do
    first = lease.acquire(connection_id: 'tab-a', initial_turn: 0)
    takeover = lease.takeover(
      connection_id: 'tab-b',
      initial_turn: 0,
      expected_generation: first.generation,
      expected_owner_connection_id: 'tab-a'
    )

    expect(takeover.status).to eq(:taken_over)
    expect(takeover.generation).to eq(first.generation + 1)
    expect(lease.heartbeat(connection_id: 'tab-a', generation: first.generation)).to be(false)
    expect(lease.heartbeat(connection_id: 'tab-b', generation: takeover.generation)).to be(true)
  end

  it 'allows exactly one winner when takeover confirmations race' do
    owner = lease.acquire(connection_id: 'tab-a', initial_turn: 0)
    gate = Queue.new
    results = %w[tab-b tab-c].map do |connection_id|
      Thread.new do
        gate.pop
        described_class.new(session_id).takeover(
          connection_id: connection_id,
          initial_turn: 0,
          expected_generation: owner.generation,
          expected_owner_connection_id: 'tab-a'
        )
      end
    end
    2.times { gate << true }

    statuses = results.map(&:value).map(&:status)
    expect(statuses.count(:taken_over)).to eq(1)
    expect(statuses.count(:in_use)).to eq(1)
  end

  it 'only allows the exact owner generation to release the lease' do
    owner = lease.acquire(connection_id: 'tab-a', initial_turn: 0)

    expect(lease.release(connection_id: 'tab-b', generation: owner.generation)).to be(false)
    expect(lease.release(connection_id: 'tab-a', generation: owner.generation)).to be(true)
    expect(lease.authoritative?(connection_id: 'tab-a', generation: owner.generation)).to be(false)
  end

  it 'selects one owner under concurrent acquisition' do
    gate = Queue.new
    results = %w[tab-a tab-b].map do |connection_id|
      Thread.new do
        gate.pop
        described_class.new(session_id).acquire(connection_id: connection_id, initial_turn: 0)
      end
    end
    2.times { gate << true }

    statuses = results.map(&:value).map(&:status)
    expect(statuses.count(:acquired)).to eq(1)
    expect(statuses.count(:in_use)).to eq(1)
  end

  it 'allocates unique monotonic turns across concurrent callbacks' do
    owner = lease.acquire(connection_id: 'tab-a', initial_turn: 10)
    turns = 8.times.map do
      Thread.new do
        described_class.new(session_id).next_turn(
          connection_id: 'tab-a',
          generation: owner.generation
        )
      end
    end.map(&:value)

    expect(turns.sort).to eq((11..18).to_a)
  end

  it 'fails closed when Redis is unavailable' do
    unavailable = described_class.new(session_id, redis_factory: -> { raise Redis::CannotConnectError })

    expect do
      unavailable.acquire(connection_id: 'tab-a', initial_turn: 0)
    end.to raise_error(described_class::Unavailable)
  end
end
