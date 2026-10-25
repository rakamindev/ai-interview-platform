ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('Refusing to run specs in production') if Rails.env.production?
require 'rspec/rails'
require 'sidekiq/testing'
Sidekiq::Testing.fake!
ActiveRecord::Migration.maintain_test_schema!
Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.include AssessmentFixtures
  config.before { Current.clear; Sidekiq::Worker.clear_all }
  config.after { Current.clear }
  config.order = :random
  Kernel.srand config.seed
end
