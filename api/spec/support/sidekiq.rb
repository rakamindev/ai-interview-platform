require 'sidekiq/testing'

# Default to fake mode: perform_async/perform_in enqueue into an in-memory
# array (Worker.jobs) instead of executing inline. Specs that need to assert
# "X was enqueued" read that array; specs exercising `#perform` call it
# directly so behavior is observed one job at a time, matching how Sidekiq
# actually invokes workers.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before(:each) do
    Sidekiq::Worker.clear_all
  end
end
