# frozen_string_literal: true

# Rack::Attack throttling is keyed by IP; every RSpec request comes from the
# same (127.0.0.1) address, so repeated auth requests would trip the 429 limit.
# Disable throttling for the whole suite. This does not touch prod config.
RSpec.configure do |config|
  config.before(:suite) { Rack::Attack.enabled = false }
end
