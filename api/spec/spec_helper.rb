# frozen_string_literal: true

require 'rspec/core'

RSpec.configure do |config|
  config.order = :random
  config.disable_monkey_patching!
  config.expect_with(:rspec) { |expectations| expectations.syntax = :expect }
end
