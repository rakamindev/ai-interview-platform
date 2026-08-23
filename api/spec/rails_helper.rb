# frozen_string_literal: true

require "spec_helper"
# Force (not ||=): the dev container exports RAILS_ENV=development and
# DB_NAME=rakamin_development for the Puma/Sidekiq processes. Without
# overriding both here, rspec boots in development against the live dev
# database — and DatabaseCleaner's truncation (spec/support/database_cleaner.rb)
# then wipes real in-progress session/portfolio data out from under it.
ENV["RAILS_ENV"] = "test"
ENV["DB_NAME"] = "rakamin_test"
require_relative "../config/environment"

# Compat shim: Ruby 3.3+ removed ERB::ENCODING_FLAG which ActionView 7.0.x
# references in ActionView::Template::Handlers::ERB. Define it after Rails
# boots (so the class hierarchy exists) but before rspec/rails loads the
# ActionView testing infrastructure.
unless ActionView::Template::Handlers::ERB.const_defined?(:ENCODING_FLAG)
  ActionView::Template::Handlers::ERB.const_set(:ENCODING_FLAG, false)
end

require "rspec/rails"
require "database_cleaner/active_record"

Rails.root.glob("spec/support/**/*.rb").each { |f| require f }

# Rack::Attack shares a Redis-backed counter across every request in this
# process (and across separate rspec runs, since the store isn't test-scoped).
# Without this, ordinary specs that hit /auth/login more than 5x/minute (e.g.
# the refresh-token spec suite) get 429'd by the same throttle a real client
# would hit — API-IMP-10/API-ENH-01's throttle specs opt back in explicitly.
Rack::Attack.enabled = false

RSpec.configure do |config|
  config.use_transactional_fixtures = false # DatabaseCleaner handles it
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include TenantHelper
  config.include AuthHelper
  config.include GeminiHelper
end
