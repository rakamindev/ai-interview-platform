# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative 'spec_helper'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'database_cleaner/active_record'
require 'sidekiq/testing'

# Every AI-interview model is TenantScoped: its default_scope reads
# Current.tenant_id out of RequestStore, and tenant_id is NOT NULL. Without a
# tenant set, every factory would fail validation and every query would silently
# return unscoped rows — so specs would pass for the wrong reason.
TEST_TENANT_ID = 1

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods

  config.fixture_path = nil
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.around(:each) do |example|
    DatabaseCleaner.cleaning { example.run }
  end

  config.before(:each) do
    Current.tenant_id = TEST_TENANT_ID
    Sidekiq::Worker.clear_all
  end

  config.after(:each) { Current.clear }
end

# Jobs are enqueued, never executed, unless a spec opts in with
# Sidekiq::Testing.inline! — keeps unit specs from making real Gemini calls.
Sidekiq::Testing.fake!
