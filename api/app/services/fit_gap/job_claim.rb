# frozen_string_literal: true

require 'time'

module FitGap
  # In-process duplicate guard for a JSON claim map.
  # A second worker that arrives while the claim is fresh must not start
  # another model call for the same portfolio and vacancy.
  module JobClaim
    module_function

    def fresh?(claims, key, now: Time.now, ttl_seconds: 180)
      raw = value_for(claims, key)
      return false if raw.nil? || raw.to_s.strip.empty?

      started = Time.iso8601(raw.to_s)
      (now - started) < ttl_seconds
    rescue ArgumentError
      false
    end

    def value_for(claims, key)
      return nil unless claims.is_a?(Hash)

      claims[key] || claims[key.to_s] || claims[key.to_sym]
    end
  end
end
