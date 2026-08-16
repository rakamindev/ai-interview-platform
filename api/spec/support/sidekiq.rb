# frozen_string_literal: true

require 'sidekiq/testing'

Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before(:each) { Sidekiq::Worker.clear_all }
end
