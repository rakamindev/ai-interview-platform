# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
# Tests never talk to Gemini: every client is stubbed. These values only satisfy ENV.fetch calls.
ENV['GEMINI_API_KEY'] ||= 'test-key-not-real'
ENV['SECRET_KEY_BASE'] ||= 'test-secret-key-base-not-real'
ENV['ALLOWED_ORIGINS'] ||= 'http://localhost:5173'

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

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include TestData
  config.include JobControl

  config.before do
    Sidekiq::Testing.fake!
    Sidekiq::Worker.clear_all
    RequestStore.clear!
  end

  config.after { RequestStore.clear! }
end
