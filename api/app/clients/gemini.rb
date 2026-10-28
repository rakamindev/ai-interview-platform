# frozen_string_literal: true

module Gemini
  # Explicit namespace for the gemini/ directory plus the app-facing helpers
  # that every service should use.
  class << self
    # Returns the client to use for a call-site role (:analysis, :narrative,
    # :portfolio, :check). Routes to the mock or the real HTTP client based on
    # Gemini::Config; raises NotConfiguredError when AI is turned off.
    def client(role = nil, **options)
      Factory.client(role: role, **options)
    end

    # Which client a role would get right now: :live, :mock, :disabled or
    # :unconfigured. Safe to log or show to an admin.
    def mode
      Factory.mode
    end
  end
end