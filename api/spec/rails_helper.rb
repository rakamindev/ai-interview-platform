# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'

# Jobs are recorded in PortfolioGeneratorWorker.jobs instead of being pushed to Redis.
require 'sidekiq/testing'
Sidekiq::Testing.fake!

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  # Every example runs in a transaction that is rolled back, so no test data is left behind.
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.before { Sidekiq::Worker.clear_all }
end
