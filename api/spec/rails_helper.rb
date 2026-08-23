# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'

require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'database_cleaner/active_record'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.fixture_paths = [Rails.root.join('spec/fixtures')] if config.respond_to?(:fixture_paths=)
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  # ── Tenancy ────────────────────────────────────────────────────────────
  #
  # TenantScoped hangs its default_scope off RequestStore, and
  # TenantScopedThrough reads the same key. Outside a request neither is set,
  # so specs have to establish it themselves — and clear it afterwards, or a
  # leaked tenant id silently changes what the next example can see.
  config.include TenantContext

  config.before(:suite) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.clean_with(:truncation, except: %w[schema_migrations ar_internal_metadata])
  end

  config.around do |example|
    DatabaseCleaner.cleaning { example.run }
  end

  config.after do
    RequestStore.clear!
  end
end
