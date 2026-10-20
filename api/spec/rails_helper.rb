# frozen_string_literal: true

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
abort('Rails is running in production mode!') if Rails.env.production?

require 'spec_helper'
require 'rspec/rails'
require 'sidekiq/testing'

Dir[Rails.root.join('spec/support/**/*.rb')].sort.each { |f| require f }

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.before do
    Sidekiq::Testing.fake!
    Sidekiq::Worker.clear_all
    RequestStore.clear!
  end
end
