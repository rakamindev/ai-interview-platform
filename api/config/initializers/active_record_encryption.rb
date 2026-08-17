# frozen_string_literal: true

# Key values themselves are wired in config/application.rb's before_initialize
# block (must run earlier than this file to take effect) — this just guards
# against booting production with them missing.
Rails.application.config.after_initialize do
  if Rails.env.production?
    required_vars = %w[
      ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY
      ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY
      ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT
    ]
    missing = required_vars.reject { |var| ENV[var].present? }

    raise "Missing required ActiveRecord Encryption environment variables: #{missing.join(', ')}" if missing.any?
  end
end
