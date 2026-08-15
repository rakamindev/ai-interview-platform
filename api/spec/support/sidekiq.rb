# frozen_string_literal: true

require 'sidekiq/testing'

# Controllers enqueue with perform_async, which would otherwise require a live
# Redis for specs that are not testing Sidekiq at all. Fake mode collects jobs
# in an array so they can be asserted on directly.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before { Sidekiq::Worker.clear_all }
end
