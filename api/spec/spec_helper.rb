# frozen_string_literal: true

require 'rspec/core'
require 'rspec/expectations'
require 'rspec/mocks'
require 'active_support/core_ext/object/blank'
require 'active_support/core_ext/hash/indifferent_access'
require 'active_support/core_ext/enumerable'

module ExceptionHandler
  class Unauthorized < StandardError; end
  class InvalidToken < StandardError; end
  class MissingToken < StandardError; end
end

class Message
  def self.unauthorized = 'Unauthorized'
  def self.missing_token = 'Missing token'
end

RSpec.configure do |config|
  config.expect_with(:rspec) { |expectations| expectations.syntax = :expect }
  config.mock_with(:rspec) { |mocks| mocks.syntax = :expect }
end
