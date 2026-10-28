# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

# Fails loudly when a migration has not been applied to the test database
# instead of producing confusing column-missing errors.
ActiveRecord::Migration.maintain_test_schema!

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  # Every example runs inside a rolled-back transaction: the interview graph
  # is built in code (the project ships no fixtures).
  config.use_transactional_fixtures = true
end
