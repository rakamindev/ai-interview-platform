# frozen_string_literal: true

require 'json'
require 'logger'
require 'rspec'
require 'timeout'
require 'active_support/all'

unless defined?(Rails)
  module Rails
    def self.logger
      @logger ||= Logger.new(nil)
    end
  end
end

RSpec.configure do |config|
  config.order = :random
  config.example_status_persistence_file_path = 'tmp/rspec_examples.txt'
  config.disable_monkey_patching!
  config.expect_with(:rspec) { |expectations| expectations.syntax = :expect }
end
