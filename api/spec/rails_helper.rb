# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
ENV['SECRET_KEY_BASE'] ||= 'assessment-test-secret'

require File.expand_path('../config/environment', __dir__)
require 'rspec/rails'
require 'factory_bot_rails'

abort('The Rails environment is running in production mode!') if Rails.env.production?

ActiveRecord::Migration.maintain_test_schema!

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |file| require file }

RSpec.configure do |config|
  config.fixture_path = "#{Rails.root}/spec/fixtures"
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!
  config.include FactoryBot::Syntax::Methods

  config.before do
    Current.clear
  end

  config.after do
    Current.clear
  end
end
