# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'

# JsonWebToken calls ENV.fetch('SECRET_KEY_BASE') with no default. Without this
# every auth path raises KeyError before the assertion under test is reached.
ENV['SECRET_KEY_BASE'] ||= 'test-secret-key-base-not-a-real-secret'

# Force the Gemini stub in test. No spec may reach the network: a suite that
# depends on a vendor is a suite that fails for reasons unrelated to the code.
ENV['GEMINI_STUB'] = 'true'
ENV['GEMINI_API_KEY'] ||= 'stub'

require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

Rails.root.glob('spec/support/**/*.rb').sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join('spec/fixtures')] if config.respond_to?(:fixture_paths=)
  config.use_transactional_fixtures = false # DatabaseCleaner owns truncation
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
end
