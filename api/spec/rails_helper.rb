# frozen_string_literal: true

require 'spec_helper'

ENV['RAILS_ENV'] ||= 'test'

# Tests must never use a real Gemini key. Figaro does not overwrite ENV keys
# that are already set, so this wins over config/application.yml.
ENV['GEMINI_API_KEY'] = 'test-dummy-gemini-key'

require_relative '../config/environment'
abort('The Rails environment is running in production mode!') if Rails.env.production?

require 'rspec/rails'
require 'webmock/rspec'
require 'sidekiq/testing'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }

# The test database is built with `rails db:migrate` (not db:schema:load),
# because schema.rb cannot express the ai_interview Postgres schema.
begin
  ActiveRecord::Migration.check_pending!
rescue ActiveRecord::PendingMigrationError => e
  abort("#{e.message.strip}\nRun: RAILS_ENV=test bundle exec rails db:migrate")
end

# No outbound HTTP from tests; Gemini is replaced by FakeGeminiClient.
WebMock.disable_net_connect!

# Jobs are pushed to an in-memory array instead of Redis.
Sidekiq::Testing.fake!

# Keep throttle state out of the shared Redis instance.
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include ActiveSupport::Testing::TimeHelpers
  config.include AuthHelpers, type: :request

  config.before do
    RequestStore.clear!
    Sidekiq::Worker.clear_all
    Rack::Attack.cache.store.clear
  end
end
