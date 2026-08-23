# frozen_string_literal: true

# Gemini client selection.
#
# GEMINI_STUB=true (the compose default, see docker-compose.yml) substitutes
# Gemini::StubClient for Gemini::HttpClient so the whole product runs without a
# key. The redirect lives here so no service constructor changes — every
# service already accepts `gemini_client:` for injected clients, and the stub
# mirrors the real interface. GEMINI_STUB_MODE selects the fixture mode
# (:valid by default).

if ENV["GEMINI_STUB"] == "true"
  Rails.application.config.after_initialize do
    module Gemini
      class HttpClient
        class << self
          alias __unstubbed_new new
        end

        def self.new(**kwargs)
          Gemini::StubClient.new(model: kwargs[:model], timeout: kwargs[:timeout])
        end
      end
    end
  end
end

# Validate that required Gemini environment variables are present at boot.
# Raises on startup if missing, rather than failing silently at runtime.
Rails.application.config.after_initialize do
  if Rails.env.production?
    required_vars = %w[GEMINI_API_KEY GEMINI_LIVE_MODEL GEMINI_FLASH_MODEL GEMINI_PRO_MODEL]
    missing = required_vars.reject { |var| ENV[var].present? }

    raise "Missing required Gemini environment variables: #{missing.join(', ')}" if missing.any?
  end
end
