# frozen_string_literal: true

# Validate that required Gemini environment variables are present at boot.
# Raises on startup if missing, rather than failing silently at runtime.
Rails.application.config.after_initialize do
  if Rails.env.production?
    required_vars = %w[GEMINI_API_KEY]
    model_groups = {
      'GEMINI_LIVE_MODELS or GEMINI_LIVE_MODEL' => %w[GEMINI_LIVE_MODELS GEMINI_LIVE_MODEL],
      'GEMINI_FLASH_MODELS or GEMINI_FLASH_MODEL' => %w[GEMINI_FLASH_MODELS GEMINI_FLASH_MODEL],
      'GEMINI_PRO_MODELS or GEMINI_PRO_MODEL' => %w[GEMINI_PRO_MODELS GEMINI_PRO_MODEL]
    }
    missing = required_vars.reject { |var| ENV[var].present? }
    missing.concat(model_groups.filter_map { |label, vars| label unless vars.any? { |var| ENV[var].present? } })

    if missing.any?
      raise "Missing required Gemini environment variables: #{missing.join(', ')}"
    end
  end
end
