# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require 'spec_helper'
require File.expand_path('../config/environment', __dir__)

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'database_cleaner/active_record'

# Fail fast with a readable message instead of a wall of migration output.
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.fixture_path = nil
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
    DatabaseCleaner.strategy = :transaction
  end

  config.around(:each) do |example|
    DatabaseCleaner.cleaning { example.run }
  end

  # Every model that includes TenantScoped applies a default_scope keyed on
  # Current.tenant_id, which is normally populated per request by
  # TenantResolverMiddleware. Specs run outside the middleware stack, so the
  # request-scoped store must be cleared between examples or tenant state leaks
  # from one example into the next.
  config.after(:each) { RequestStore.clear! }
end
