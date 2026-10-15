# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
# Defaults so the suite runs without a local config/application.yml (e.g. in CI).
ENV['SECRET_KEY_BASE'] ||= 'test-secret-key-base'
ENV['GEMINI_API_KEY'] ||= 'test-key-not-used'
ENV['REDIS_URL'] ||= 'redis://localhost:6379/15'

require 'spec_helper'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'
require 'sidekiq/testing'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include FactoryBot::Syntax::Methods

  config.before do
    Sidekiq::Worker.clear_all
    Sidekiq.redis { |conn| conn.call('FLUSHDB') }
  end

  config.after do
    RequestStore.clear!
  end
end
