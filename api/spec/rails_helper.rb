# frozen_string_literal: true

# This file is copied to spec/ when you run 'rails generate rspec:install'.
# Keep this thin: unit specs that inject Gemini doubles do not need the DB.

ENV['RAILS_ENV'] ||= 'test'

require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
end
