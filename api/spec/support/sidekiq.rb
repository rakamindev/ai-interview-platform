# frozen_string_literal: true

require 'sidekiq/testing'

# Keep job enqueues in-process so specs do not need Redis.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before { Sidekiq::Worker.clear_all }
end
