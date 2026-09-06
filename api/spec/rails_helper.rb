# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'

Dir[Rails.root.join('spec', 'support', '**', '*.rb')].sort.each { |file| require file }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  # Current (RequestStore) is thread-local and leaks across examples running in
  # the same thread — a tenant from a previous example would otherwise "just work".
  config.after(:each) do
    RequestStore.store.delete(:user)
    RequestStore.store.delete(:organization)
    RequestStore.store.delete(:tenant_id)
  end

  # Allows `build` / `create` directly inside specs instead of FactoryBot.create(...)
  config.include FactoryBot::Syntax::Methods
end
