# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'factory_bot'
require 'sidekiq/testing'

# Load request/model service specs cleanly; main test DB schema must be current.
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  warn e.to_s.strip
  exit 1
end

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include AuthHelper, type: :request
  config.include TestEnvHelper

  # Sidekiq jobs are asserted, not executed, by default.
  config.before(:each) do
    Current.clear
    Sidekiq::Testing.fake!
    Sidekiq::Queues.clear_all
  end

  # Throttling is exercised by its own specs; keep request specs deterministic.
  config.before(:suite) { Rack::Attack.enabled = false }
end