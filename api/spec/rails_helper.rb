# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.before(:each) do
    org = Organization.find_or_create_by!(scheme: 'demo') do |o|
      o.name = 'Demo Organization'
      o.identifier = 'demo'
      o.host = 'localhost'
    end
    Current.organization = org
    Current.tenant_id = org.id
  end

  # Helper for generating auth headers
  config.include(Module.new do
    def auth_headers(user_id: 1, role: 'admin', scheme: 'demo')
      token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: scheme })
      {
        'Authorization' => "Bearer #{token}",
        'Content-Type' => 'application/json',
        'X-Tenant-Scheme' => scheme
      }
    end
  end, type: :request)
end
