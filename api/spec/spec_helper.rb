# frozen_string_literal: true

require "rspec/core"

RSpec.configure do |config|
  config.expect_with(:rspec) { |c| c.syntax = :expect }
  config.order = :random
  config.disable_monkey_patching!
end