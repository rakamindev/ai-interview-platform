# frozen_string_literal: true

# DatabaseCleaner truncation — not transactional fixtures.
#
# Rationale (TO-11):
#   - schema_search_path is "ai_interview,public" — transactional fixtures
#     do not guarantee the right schema is rolled back.
#   - Seven native PG enums plus future advisory locks make nested transactions
#     hazardous; the failures are intermittent and confusing.
#   - Truncation is slower but robust across all of the above.
#
# Truncation runs after every example; the cost is low for a test suite and
# the reliability gain is real.

DatabaseCleaner[:active_record]

RSpec.configure do |config|
  config.before(:suite) do
    DatabaseCleaner.clean_with(:truncation)
  end

  config.before do
    DatabaseCleaner.start
  end

  config.after do
    DatabaseCleaner.clean
  end
end
