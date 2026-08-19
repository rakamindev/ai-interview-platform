# frozen_string_literal: true

# `sidekiq/testing` (required in rails_helper.rb) defaults to `fake!` — jobs are
# enqueued into an in-memory array, not executed. Prefer testing workers directly
# by instantiating them and calling #perform, rather than `.inline!`, which runs
# jobs in the caller's thread and does NOT clear RequestStore the way a real
# Sidekiq process does — an inline job in a request spec would run with tenant
# scoping still active, unlike production.
RSpec.configure do |config|
  config.before do
    Sidekiq::Worker.clear_all
  end
end
