# frozen_string_literal: true

require 'sidekiq/testing'

# Put Sidekiq in "fake" mode so perform_async pushes to an in-process job list
# that specs can assert on, and no job ever actually runs against Redis/the app.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before(:each) do
    Sidekiq::Job.clear_all
  end
end