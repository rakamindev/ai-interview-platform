# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'

# Ensure SECRET_KEY_BASE is available for JWT encoding/decoding in tests.
# Figaro loads from application.yml, but tests may not have that file.
ENV['SECRET_KEY_BASE'] ||= 'test-secret-key-base-for-rspec-only'

require_relative '../config/environment'

abort("The Rails environment is running in production mode!") if Rails.env.production?
require 'rspec/rails'

# Load all support files
Dir[Rails.root.join('spec', 'support', '**', '*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  # Use DatabaseCleaner instead of transactional fixtures
  config.use_transactional_fixtures = false

  # Infer spec type from file location (e.g., spec/models/ → type: :model)
  config.infer_spec_type_from_file_location!

  # Filter Rails framework backtrace for cleaner output
  config.filter_rails_from_backtrace!

  # Clear RequestStore between tests to prevent tenant/user bleed
  config.before(:each) do
    RequestStore.clear!
  end
end

