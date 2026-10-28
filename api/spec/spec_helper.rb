# frozen_string_literal: true

# Minimal helper: the specs in this folder test plain Ruby logic and do not boot Rails.
RSpec.configure do |config|
  config.expect_with(:rspec) { |expectations| expectations.syntax = :expect }
  config.disable_monkey_patching!
end
