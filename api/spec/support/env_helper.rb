# frozen_string_literal: true

# Runs a block with some env vars set (nil removes one), then puts them back.
module EnvHelper
  def with_env(values)
    saved = values.keys.to_h { |key| [key, ENV.fetch(key, nil)] }
    values.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    yield
  ensure
    saved&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end
end

RSpec.configure do |config|
  config.include EnvHelper
end
