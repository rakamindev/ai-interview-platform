ENV['RAILS_ENV'] = 'test'
ENV['SECRET_KEY_BASE'] ||= 'test-only-not-a-production-secret'
require_relative '../config/environment'
abort('Tests require RAILS_ENV=test') unless Rails.env.test?
require 'rspec/rails'
require 'sidekiq/testing'
Sidekiq::Testing.fake!
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
ActiveRecord::Migration.maintain_test_schema!
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }
RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.before { Current.clear; Sidekiq::Worker.clear_all }
  config.after { Current.clear }
end
