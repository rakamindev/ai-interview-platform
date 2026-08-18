# frozen_string_literal: true

# `use_transactional_fixtures = false` (see rails_helper.rb) — DatabaseCleaner owns
# transactions instead, so worker/service specs that spawn their own connections
# (e.g. via Sidekiq inline execution) still see committed data.
RSpec.configure do |config|
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before do
    DatabaseCleaner.strategy = :transaction
  end

  config.before do
    DatabaseCleaner.start
  end

  config.after do
    DatabaseCleaner.clean
  end
end
