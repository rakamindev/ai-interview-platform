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

  # Use a real queuing backend for Active Job.
  config.active_job.queue_adapter = :sidekiq

  # Use default logging formatter so that PID and timestamp are not suppressed.
  config.log_tags = [:request_id]

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Suppress deprecation notices.
  config.active_support.deprecation = :notify
  config.active_support.disallowed_deprecation = :log
  config.active_support.disallowed_deprecation_warnings = []

  # Cache and throttle counters get their own instance when REDIS_CACHE_URL is set:
  # sharing the Sidekiq database means an eviction or a runaway cache can destroy
  # queue entries, and an unbounded cache can grow without limit.
  # Required instance policies: the Sidekiq/publisher instance runs
  # `maxmemory-policy noeviction`; this instance runs `maxmemory-policy allkeys-lru`
  # with an explicit `maxmemory`.
  cache_url = ENV["REDIS_CACHE_URL"].to_s.strip
  cache_url = ENV.fetch("REDIS_URL", "redis://localhost:6379/0") if cache_url.empty?
  config.cache_store = :redis_cache_store, {
    url:             cache_url,
    connect_timeout: 1,
    read_timeout:    1,
    write_timeout:   1
  }
end
