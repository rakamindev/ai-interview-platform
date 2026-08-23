# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

Rails.application.configure do
    # Code is not reloaded between requests.
    config.cache_classes = false

    # Do not eager load code on boot.
    config.eager_load = false

    # Show full error reports.
    config.consider_all_requests_local = true

    # Enable server timing.
    config.server_timing = true

    # Store uploaded files on the local file system (see config/storage.yml for options).
    # config.active_storage.service = :local

    # Don't care if the mailer can't send.
    # config.action_mailer.raise_delivery_errors = false
    # config.action_mailer.perform_caching = false

    # Print deprecation notices to the Rails logger.
    config.active_support.deprecation = :log

    # Raise exceptions for disallowed deprecations.
    config.active_support.disallowed_deprecation = :raise

    # Tell Active Support which deprecation messages to disallow.
    config.active_support.disallowed_deprecation_warnings = []

    # Raise an error on page load if there are pending migrations.
    config.active_record.migration_error = :page_load

    # Highlight code that triggered database queries in logs.
    config.active_record.verbose_query_logs = true

    # Suppress logger output for asset requests.
    # config.assets.quiet = true

    # Log level
    config.log_level = :debug

    # Use an evented file watcher to asynchronously detect changes in source code,
    # routes, locales, etc. This feature depends on the listen gem.
    config.file_watcher = ActiveSupport::EventedFileUpdateChecker

    config.cache_store = :redis_cache_store, {
        url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0")
    }
end
