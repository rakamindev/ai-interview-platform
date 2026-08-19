# frozen_string_literal: true

require File.expand_path('../config/environment', __dir__)
require 'rspec/rails'
require_relative 'spec_helper'

RSpec.configure do |config|
  config.use_transactional_fixtures = true
end
