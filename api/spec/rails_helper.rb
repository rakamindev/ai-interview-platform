# frozen_string_literal: true

ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"

abort("The Rails environment is running in production mode!") if Rails.env.production?

require "rspec/rails"
require "factory_bot_rails"
require "sidekiq/testing"

Dir[Rails.root.join("spec/support/**/*.rb")].sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.fixture_path = Rails.root.join("spec/fixtures")
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include FactoryBot::Syntax::Methods

  # Jobs are enqueued in-memory so specs never need a live Redis.
  Sidekiq::Testing.fake!

  # Throttling is exercised explicitly in spec/config/rack_attack_spec.rb; elsewhere it would
  # make unrelated specs share a per-IP budget.
  Rack::Attack.enabled = false
  config.before { Sidekiq::Worker.clear_all }
end
