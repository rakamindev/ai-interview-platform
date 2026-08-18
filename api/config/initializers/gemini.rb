# frozen_string_literal: true

# Validate that required Gemini environment variables are present at boot.
# Raises on startup if missing, rather than failing silently at runtime.
Rails.application.config.after_initialize do
  if Rails.env.production?
    required_vars = %w[GEMINI_API_KEY GEMINI_LIVE_MODEL GEMINI_FLASH_MODEL GEMINI_PRO_MODEL]
    missing = required_vars.reject { |var| ENV[var].present? }

    if missing.any?
      raise "Missing required Gemini environment variables: #{missing.join(', ')}"
    end
  end
end
