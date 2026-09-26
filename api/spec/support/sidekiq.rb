# frozen_string_literal: true

require 'sidekiq/testing'

# Jobs are recorded, not run. A spec runs a job on purpose when it needs to.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before { Sidekiq::Worker.clear_all }
end
