# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'factory_bot'
require 'database_cleaner/active_record'

# Load all spec support files (helpers + factories support)
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_path = Rails.root.join('spec/fixtures')
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include TenantHelpers
  config.include ApiHelpers, type: :request

  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before do |example|
    # :concurrency examples spawn threads with their own DB connections, so they
    # need real committed data (truncation) instead of a shared transaction.
    DatabaseCleaner.strategy = example.metadata[:concurrency] ? :truncation : :transaction
    DatabaseCleaner.start
    Current.clear
  end

  config.after do
    DatabaseCleaner.clean
    Current.clear
  end
end