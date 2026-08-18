# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require 'spec_helper'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

# ⚠ Deliberately NOT `ActiveRecord::Migration.maintain_test_schema!`.
#
# `db/schema.rb` never captures `CREATE SCHEMA ai_interview` (that statement lives only in
# `db/migrate/20240101000000_create_ai_interview_schema.rb`), so `db:schema:load` /
# `maintain_test_schema!` would silently rebuild every table in `public` and report success.
# The test DB must be built with `RAILS_ENV=test bin/rails db:create db:migrate` instead.
unless ActiveRecord::Base.connection.schema_exists?('ai_interview')
  abort <<~MSG
    ══════════════════════════════════════════════════════════════════════════
    The `ai_interview` Postgres schema does not exist in the test database.

    Do NOT run `db:test:prepare` or `db:schema:load` — schema.rb does not
    contain the `CREATE SCHEMA ai_interview` statement, so either would
    silently create every table in the `public` schema instead.

    Build the test database with:

        RAILS_ENV=test bin/rails db:create db:migrate

    ══════════════════════════════════════════════════════════════════════════
  MSG
end

require 'rspec/rails'
require 'sidekiq/testing'
require 'webmock/rspec'

# Requires supporting files with custom matchers and macros, etc.,
# in ./support/ and its subdirectories.
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.fixture_path = Rails.root.join('spec/fixtures')
  config.use_transactional_fixtures = false
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
end
