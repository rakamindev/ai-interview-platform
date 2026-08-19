# frozen_string_literal: true

# This file is copied to spec/ when you run 'rails generate rspec:install'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

# Prevent database truncation if the environment is production
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'factory_bot'
require 'database_cleaner/active_record'
require 'timecop'

# Load support files (tenant context, helpers)
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  # Use DatabaseCleaner instead of transactional fixtures so we can also run
  # multi-threaded specs (transactions can't span threads). Default strategy is
  # :transaction; individual specs can opt into :truncation via metadata e.g.
  # `cleaner_strategy: :truncation` to allow cross-thread DB visibility.
  config.use_transactional_fixtures = false

  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include TenantContext

  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before(:each) do |example|
    # Default to a transaction per example; threads see committed writes only
    # when a spec opts into :truncation.
    DatabaseCleaner.strategy = example.metadata[:cleaner_strategy] || :transaction
    DatabaseCleaner.start
  end

  config.append_after(:each) do
    DatabaseCleaner.clean
    RequestStore.clear!
  end
end