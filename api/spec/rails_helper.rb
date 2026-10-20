# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] = 'test'
require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'
require 'sidekiq/testing'

Rails.root.glob('spec/support/**/*.rb').sort.each { |f| require f }

begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

# `build(:session)` still needs a persisted organization to take its tenant_id from.
FactoryBot.use_parent_strategy = false

# Jobs are pushed to an in-memory array instead of Redis; specs assert on them.
Sidekiq::Testing.fake!

# Rate limiting would make request specs order-dependent.
Rack::Attack.enabled = false

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include ActiveSupport::Testing::TimeHelpers
  config.include AuthHelpers, type: :request

  config.before do
    Sidekiq::Worker.clear_all
    RequestStore.clear!
  end
end
