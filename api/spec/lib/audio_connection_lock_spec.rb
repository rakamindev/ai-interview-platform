# frozen_string_literal: true

require "rails_helper"

RSpec.describe AudioConnectionLock do
  # Minimal in-memory stand-in for the Redis commands the lock uses.
  class FakeRedis
    def initialize = (@store = {})
    def set(key, val, nx: false, ex: nil)
      return false if nx && @store.key?(key)
      @store[key] = val
      true
    end
    def get(key) = @store[key]
    def del(key) = @store.delete(key)
    def expire(key, _ttl) = @store.key?(key)
    def close; end
  end

  let(:redis) { FakeRedis.new }

  def lock_for(session_id) = described_class.new(session_id, redis: redis)

  it "lets the first connection in and rejects a second one for the same session" do
    expect(lock_for(1).acquire).to be(true)
    expect(lock_for(1).acquire).to be(false)
  end

  it "does not block a different session" do
    lock_for(1).acquire

    expect(lock_for(2).acquire).to be(true)
  end

  it "lets a new connection in after the first releases (page refresh)" do
    first = lock_for(1)
    first.acquire
    first.release

    expect(lock_for(1).acquire).to be(true)
  end

  it "does not release a lock that now belongs to another connection" do
    stale = lock_for(1)
    stale.acquire
    redis.del("audio_ws:1")          # TTL expired while the first tab was frozen
    fresh = lock_for(1)
    fresh.acquire

    stale.release

    expect(lock_for(1).acquire).to be(false) # fresh still holds it
  end

  it "fails open when Redis is unavailable, so an outage cannot lock candidates out of their interview" do
    broken = instance_double(FakeRedis)
    allow(broken).to receive(:set).and_raise(StandardError, "connection refused")
    allow(broken).to receive(:close)

    expect(described_class.new(1, redis: broken).acquire).to be(true)
  end
end
