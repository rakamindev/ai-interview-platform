# frozen_string_literal: true

require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Code is not reloaded between requests.
  config.cache_classes = true

  # Eager load code on boot for performance.
  config.eager_load = true

  # Full error reports are disabled.
  config.consider_all_requests_local = false

  # Ensures that a master key has been made available in ENV["RAILS_MASTER_KEY"],
  # config/master.key, or an environment key such as config/credentials/production.key.
  # config.require_master_key = true

  # Disable serving static files from `public/`.
  config.public_file_server.enabled = ENV["RAILS_SERVE_STATIC_FILES"].present?

  # Enable log buffering.
  config.force_ssl = ENV.fetch("FORCE_SSL", "true") == "true"

  # Log to STDOUT — required for log aggregation in containerized deployments.
  logger           = ActiveSupport::Logger.new($stdout)
  logger.formatter = config.log_formatter
  config.logger    = ActiveSupport::TaggedLogging.new(logger)

  # Log level (default: info in production)
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info").to_sym

  # Jobs use Sidekiq::Worker, not Active Job. This app is api_only and does not
  # load the active_job railtie, so config.active_job is undefined.
  # config.active_job.queue_adapter = :sidekiq

  # Use default logging formatter so that PID and timestamp are not suppressed.
  config.log_tags = [:request_id]

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Suppress deprecation notices.
  config.active_support.deprecation = :notify
  config.active_support.disallowed_deprecation = :log
  config.active_support.disallowed_deprecation_warnings = []

  # Use a cache store that supports distributed caching.
  config.cache_store = :redis_cache_store, { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }
end
