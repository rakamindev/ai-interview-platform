# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'factory_bot'
require 'database_cleaner/active_record'
require 'sidekiq/testing'
Sidekiq::Testing.fake!

Dir[Rails.root.join('spec', 'support', '**', '*.rb')].each { |f| require f }

ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
  config.include ActiveSupport::Testing::TimeHelpers

  config.fixture_path = Rails.root.join('spec', 'fixtures')
  config.use_transactional_fixtures = true

  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.start
    # Ensure a stale tenant_id from a previous example can never leak into the
    # current one. Removing the key (not setting nil) keeps TenantScoped's
    # default_scope honest: with no key it returns all rows, which is what a
    # non-tenant-context spec expects.
    RequestStore.store.delete(:tenant_id)
    RequestStore.store.delete(:organization)
  end

  config.append_after do
    DatabaseCleaner.clean
    RequestStore.clear!
  end

  config.infer_spec_type_from_file_location!
end
