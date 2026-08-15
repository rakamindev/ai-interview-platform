# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before do
    DatabaseCleaner.strategy = :transaction
  end

  # Specs that assert on transactional rollback must not themselves run inside a
  # wrapping transaction, or the rollback under test is indistinguishable from
  # the cleaner's own. Tag these :truncation.
  config.before(:each, :truncation) do
    DatabaseCleaner.strategy = :truncation
  end

  config.around do |example|
    DatabaseCleaner.cleaning { example.run }
  end
end
