# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort("The Rails environment is running in production mode!") if Rails.env.production?
require 'rspec/rails'
require 'database_cleaner/active_record'
require 'sidekiq/testing'

# Require support files
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include TenantHelpers, type: :model
  config.include TenantHelpers, type: :service

  # Create test organization for tenant resolution (scheme must match JWT)
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
    Organization.find_or_create_by!(scheme: 'test-corp') do |org|
      org.name = 'Test Corp'
      org.identifier = 'test-corp'
      org.host = 'localhost'
    end
  end

  # Set tenant_id for TenantScoped models
  config.before(:each) do
    Current.tenant_id = 1
  end

  config.after(:each) do
    Current.clear
  end

  # DatabaseCleaner config
  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
  end

  config.before(:each, js: true) do
    DatabaseCleaner.strategy = :truncation
  end

  config.before(:each) do
    DatabaseCleaner.start
  end

  config.after(:each) do
    DatabaseCleaner.clean
  end

  # Clean Sidekiq jobs between tests
  config.before(:each) do
    Sidekiq::Worker.clear_all
  end

  # Reset Rack::Attack throttle counters (stored in Redis, persists across runs)
  config.before(:each, type: :request) do
    Rack::Attack.cache.store.clear
  end
end

Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
