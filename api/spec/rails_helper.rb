# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
require File.expand_path('../config/environment', __dir__)
require 'spec_helper'
require 'rspec/rails'

# Require support files (factories, helpers).
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.fixture_path = Rails.root.join('spec/fixtures')
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods

  # Tenant context helper — most specs run inside a tenant.
  config.around(:each) do |example|
    if example.metadata[:tenant] == false
      example.run
    else
      Current.tenant_id = 1
      Current.organization = Organization.identify('test-corp')
      begin
        example.run
      ensure
        Current.clear
      end
    end
  end
end
