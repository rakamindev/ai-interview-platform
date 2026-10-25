# frozen_string_literal: true

# Load the Rails application first so the `Rails` constant is defined.
require_relative "../config/environment"

# Prevent database truncation if the environment is running in production
abort("The Rails environment is running in production mode!") if Rails.env.production?

# NOTE: Under Ruby 3.3 + actionview 7.0, rspec-rails can raise
#   NameError: uninitialized constant ActionView::ENCODING_FLAG
# when loading. Requiring action_view before rspec/rails avoids it.
require "action_view"

require "rspec/rails"

# Add additional requires below this line. Rails is not loaded until this point!

require "factory_bot_rails"

# Requires supporting ruby files with custom matchers and macros, etc.
Dir[Rails.root.join("spec", "support", "**", "*.rb")].sort.each { |f| require f }

# Checks for pending migrations and applies them before tests are run.
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.fixture_path = "#{::Rails.root}/spec/fixtures"

  config.use_transactional_fixtures = true

  config.infer_spec_type_from_file_location!

  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  # Disable Rack::Attack rate limiting during tests so repeated request-spec
  # hits don't get 429'd.
  config.before(:suite) do
    Rack::Attack.enabled = false if defined?(Rack::Attack)
  end
end
