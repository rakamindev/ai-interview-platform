# frozen_string_literal: true

# Line coverage, only when asked (COVERAGE=1, as in CI), so a local run stays fast. It must start before the app
# loads, which is why it's here and not in rails_helper. The report lands in api/coverage (gitignored).
if ENV['COVERAGE']
  require 'simplecov'
  SimpleCov.start 'rails' do
    enable_coverage :line
    add_filter %w[/spec/ /config/ /db/ /vendor/]
    # A floor a point under the line coverage measured in CI, so coverage can't quietly drop. Not a target.
    minimum_coverage ENV.fetch('COVERAGE_FLOOR', 0).to_f
  end
end

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  config.shared_context_metadata_behavior = :apply_to_host_groups
  config.filter_run_when_matching :focus
  config.example_status_persistence_file_path = 'tmp/rspec_examples.txt'
  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed
end
