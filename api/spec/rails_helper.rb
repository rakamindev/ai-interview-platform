# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'
# Initializers fetch these at boot; tests must not depend on a developer's local config.
ENV['ALLOWED_ORIGINS'] ||= 'http://localhost:5173'
ENV['SECRET_KEY_BASE'] ||= 'test-secret-key-base'
ENV['GEMINI_API_KEY']  ||= 'test-key-never-used'

require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'sidekiq/testing'

Dir[Rails.root.join('spec/support/**/*.rb')].each { |f| require f }

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
    RequestStore.clear!
  end
end
