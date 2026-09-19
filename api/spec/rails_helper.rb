# frozen_string_literal: true

require "spec_helper"

ENV["RAILS_ENV"] = "test"

require_relative "../config/environment"

abort("The Rails environment is not running in test mode!") unless Rails.env.test?

require "rspec/rails"
require "database_cleaner/active_record"

Dir[Rails.root.join("spec/support/**/*.rb")].sort.each { |f| require f }

RSpec.configure do |config|
  config.fixture_path = Rails.root.join("spec/fixtures")
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!

  config.include FactoryBot::Syntax::Methods
  config.include TenantHelper
  config.include RequestAuthHelper
  config.include GeminiHelpers

  DatabaseCleaner.clean_with(:truncation)

  config.before(:suite) { DatabaseCleaner.clean_with(:truncation) }
  config.before(:each)  { DatabaseCleaner.start }
  config.after(:each)   { DatabaseCleaner.clean }

  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
end