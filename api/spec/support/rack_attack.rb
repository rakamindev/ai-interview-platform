# frozen_string_literal: true

# Rack::Attack's throttle counters live in Redis, so they persist across test
# runs and processes. Disable it for specs so login/candidate throttle limits
# don't leak between examples and fail unrelated auth tests with 429s.
RSpec.configure do |config|
  config.before(:suite) { Rack::Attack.enabled = false }
end
