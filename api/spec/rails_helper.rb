# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'factory_bot_rails'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.fixture_path = Rails.root.join('spec/fixtures').to_s
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include ActiveSupport::Testing::TimeHelpers

  # Every AI-interview model is TenantScoped: its default_scope and its
  # before_validation both read Current.tenant_id, which raises when unset.
  # Bind a tenant for the whole suite so specs read like production code paths.
  config.include TenantContext
  config.before(:suite) { TenantContext.ensure_organizations_table! }
  config.around(:each) { |example| TenantContext.with_tenant { example.run } }
end
