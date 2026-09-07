# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
ENV['SECRET_KEY_BASE'] ||= 'test_secret_key_base_for_rspec_32_bytes_long_minimum'

require_relative '../config/environment'
abort("The Rails environment is running in production mode!") if Rails.env.production?

require 'rspec/rails'
require 'database_cleaner/active_record'

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

module RequestSpecHelper
  def json
    JSON.parse(response.body).with_indifferent_access
  end

  def auth_headers(user_id: 1, role: 'admin', scheme: 'rakamin')
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: scheme })
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end

  def candidate_headers(scheme: 'rakamin')
    {
      'X-Tenant-Scheme' => scheme,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    }
  end
end

RSpec.configure do |config|
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include RequestSpecHelper, type: :request

  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

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
end
