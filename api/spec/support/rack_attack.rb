# frozen_string_literal: true

# Rack::Attack throttles login to 5 attempts per minute per IP, and every
# request spec arrives from 127.0.0.1. The counter therefore accumulates across
# examples: a spec that logs in three times passes on its own and returns 429
# in a full run, depending on what ran before it. Order-dependent failures like
# that get diagnosed as flakiness and muted, so the counter is reset instead.
#
# Rack::Attack.reset! rather than cache.store.clear: the throttle store is
# Redis db 1, which is also Sidekiq's queue. `clear` flushes the database.
# reset! deletes only the keys under Rack::Attack's own prefix.
RSpec.configure do |config|
  config.before(type: :request) do
    Rack::Attack.reset!
  rescue StandardError
    # A missing throttle store is not a reason for an unrelated spec to fail.
    nil
  end
end
