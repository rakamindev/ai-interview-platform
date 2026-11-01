# frozen_string_literal: true

require 'sidekiq/testing'

# Runs Sessions::ClientClaim against a real Redis (its Lua scripts and atomicity cannot be faked), on a
# separate database so specs never touch the shared development data.
module IsolatedRedis
  def isolate_claim_store
    claim_url = ENV.fetch('REDIS_URL')
    isolated_url = claim_url.sub(%r{/\d+\z}, '/15')
    allow(Redis).to receive(:new).and_call_original
    allow(Redis).to receive(:new).with(url: claim_url) { Redis.new(url: isolated_url) }
    Redis.new(url: isolated_url).flushdb
    Sidekiq::Worker.clear_all
  end
end
