# frozen_string_literal: true

# Keep rate-limit counters in memory, so request specs don't need Redis.
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

RSpec.configure do |config|
  config.before { Rack::Attack.reset! }
end
