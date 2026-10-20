# frozen_string_literal: true

require 'sidekiq/testing'
require 'webmock/rspec'

# Jobs are pushed to an in-memory array instead of Redis; specs run them explicitly.
Sidekiq::Testing.fake!

# No spec may reach a real external service (Gemini quota, cost, flakiness).
WebMock.disable_net_connect!(allow_localhost: true)

# Rack::Attack keeps throttle state in Redis; throttling is not under test here.
Rack::Attack.enabled = false

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods

  config.before do
    # TenantScoped reads the current tenant from RequestStore; never leak it between examples.
    RequestStore.clear!
    Sidekiq::Worker.clear_all
  end
end
