# frozen_string_literal: true

# Minimal spec helper: unit-tests plain Ruby classes (Gemini::HttpClient,
# AudioWebSocketMiddleware control path) without booting the full Rails app.
require 'json'
require 'logger'

module Rails
  def self.logger
    @logger ||= Logger.new(File::NULL)
  end
end

RSpec.configure do |config|
  config.expect_with :rspec
  config.mock_with :rspec
  config.disable_monkey_patching!
  config.order = :random
end
