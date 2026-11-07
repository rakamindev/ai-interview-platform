# frozen_string_literal: true

# Throttling is covered by its own spec; keep it off elsewhere so request specs
# don't depend on Redis state or on each other's request counts.
RSpec.configure do |config|
  config.before { Rack::Attack.enabled = false }
end
