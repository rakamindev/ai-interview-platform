# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'

# This branch adds a migration. Without this check a stale test database fails with
# a confusing NoMethodError on generation_started_at instead of "Migrations are
# pending — run bin/rails db:test:prepare".
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  # Each example runs inside a transaction that is rolled back afterwards.
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  # Multi-tenancy: TenantScoped reads Current.tenant_id from RequestStore, which is
  # empty outside a request. Clear it between examples so a tenant leaked by one
  # spec cannot make another spec pass for the wrong reason.
  config.before do
    RequestStore.store.delete(:tenant_id)
  end
end
