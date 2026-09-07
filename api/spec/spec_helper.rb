# frozen_string_literal: true

# Pure-Ruby spec helper. Specs under spec/lib and spec/services/portfolios only
# require this file, so they run without a database or a booted Rails app —
# which is why the logic that closes the P0s was extracted into plain objects.
RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed
end
