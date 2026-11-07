# frozen_string_literal: true

require 'sidekiq/testing'

# Jobs are not executed in tests; they go to a fake queue so specs can
# assert that a job was enqueued without Redis or Gemini.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before { Sidekiq::Worker.clear_all }
end
