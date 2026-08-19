# frozen_string_literal: true

# Rack::Attack is Redis-backed and mounted unconditionally (see
# config/initializers/rack_attack.rb) — disabled by default in test so specs don't
# depend on Redis being up, and so rapid-fire test requests never trip a throttle by
# accident. Re-enabled deliberately in the one spec that needs to prove a 429 is real
# (spec/requests/api/v1/cv_screening_batches_spec.rb).
RSpec.configure do |config|
  config.before(:suite) do
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
  end

  config.before do
    Rack::Attack.enabled = false
  end
end
