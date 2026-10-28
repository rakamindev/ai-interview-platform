# frozen_string_literal: true

# Boot-time validation of the Gemini integration.
#
#   * production/staging: raise if AI is enabled but there is no key, so a
#     botched deploy fails loudly instead of silently degrading every
#     generation job.
#   * development/test: never raise — running without a key is normal here,
#     and the mock client takes over. A missing key or mock mode is logged as
#     a warning, never as a crash.
#
# The API key itself is never printed.
Rails.application.config.after_initialize do
  diagnostics = Gemini::Config.diagnostics
  strict = %w[production staging].include?(Rails.env)

  if diagnostics[:enabled] && strict && !diagnostics[:mock_mode] && diagnostics[:api_key] != 'set'
    raise 'Gemini is enabled but GEMINI_API_KEY is missing or still a placeholder (production/staging). ' \
          'Provision the real key through the deployment secret store, or set GEMINI_ENABLED=false ' \
          'to ship this release without AI features.'
  end

  summary = diagnostics.map { |k, v| "#{k}=#{v}" }.join(' ')

  if !diagnostics[:enabled]
    Rails.logger.warn("[Gemini] Disabled (GEMINI_ENABLED=false) — #{summary}")
  elsif diagnostics[:mock_mode]
    if strict
      Rails.logger.error("[Gemini] RUNNING ON THE MOCK CLIENT IN #{Rails.env} — #{summary}")
    else
      Rails.logger.info("[Gemini] mock mode — #{summary}")
    end
  else
    Rails.logger.info("[Gemini] configured for the real API — #{summary}")
  end
end