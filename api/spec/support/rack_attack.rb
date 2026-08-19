# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) { Rack::Attack.enabled = false }
end
