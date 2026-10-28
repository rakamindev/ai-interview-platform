# frozen_string_literal: true

require "rspec/core"
require "rspec/expectations"
require "rspec/mocks"
require "json"
require "active_support/core_ext/enumerable"
require "active_support/core_ext/object/blank"

RSpec.configure do |config|
  config.expect_with(:rspec) { |expectations| expectations.syntax = :expect }
end
