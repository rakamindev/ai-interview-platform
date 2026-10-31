# frozen_string_literal: true

ENV['RAILS_ENV'] = 'test'
ENV['ALLOWED_ORIGINS'] ||= 'http://localhost:5173'
require 'securerandom'
ENV['SECRET_KEY_BASE'] ||= SecureRandom.hex(64)
require_relative 'spec_helper'
require_relative '../config/environment'
require 'rspec/rails'

ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.before { Current.clear }
  config.after { Current.clear }
end
