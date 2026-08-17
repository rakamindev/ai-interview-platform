# frozen_string_literal: true

# Minimal spec_helper. The Rails boot is handled by rails_helper.
# Kept separate so plain Ruby unit specs (e.g. pure service objects) can run
# without booting the full Rails environment when desired.

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
