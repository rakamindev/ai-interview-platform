# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative 'spec_helper'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'database_cleaner/active_record'

# Prepare the test schema with `RAILS_ENV=test rails db:migrate`. db/schema.rb
# does not record the ai_interview schema, so a schema load builds a different
# database.
ActiveRecord::Migration.maintain_test_schema! if ENV['MAINTAIN_TEST_SCHEMA'] == 'true'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join('spec/fixtures')] if config.respond_to?(:fixture_paths=)
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  config.before(:suite) do
    # DatabaseCleaner reads the table list off the connection; on a lazy pool it
    # comes back empty and the truncation silently cleans nothing.
    ActiveRecord::Base.connection.execute('SELECT 1')

    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation)
  end

  config.around do |example|
    DatabaseCleaner.cleaning { example.run }
  end

  # RequestStore is process global: a leaked tenant activates TenantScoped.
  config.after { Current.clear }
end
