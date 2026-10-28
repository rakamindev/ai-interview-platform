# frozen_string_literal: true

module EnvHelpers
  # Sets ENV keys for the duration of the block and restores them afterwards,
  # so examples that assert on configuration never leak into other examples.
  def with_env(overrides)
    originals = overrides.keys.each_with_object({}) { |key, acc| acc[key] = ENV[key] }
    overrides.each { |key, value| ENV[key] = value }
    yield
  ensure
    originals.each { |key, value| ENV[key] = value }
  end
end

RSpec.configure do |config|
  config.include EnvHelpers
end
