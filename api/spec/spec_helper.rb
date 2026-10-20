# frozen_string_literal: true

RSpec.configure do |config|
  config.expect_with(:rspec) { |c| c.include_chain_clauses_in_custom_matcher_descriptions = true }
  config.mock_with(:rspec) { |m| m.verify_partial_doubles = true }
  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.order = :random
  Kernel.srand config.seed
end
