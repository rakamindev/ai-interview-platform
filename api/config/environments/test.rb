# frozen_string_literal: true

require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # While tests run files are not watched, reloading is not necessary.
  config.cache_classes = true

  # Eager loading loads your whole application. When running a single test locally,
  # this might not be necessary. It's recommended that you set this to true in CI though.
  config.eager_load = ENV["CI"].present?

  # Configure public file server for tests with Cache-Control for performance.
  config.public_file_server.enabled = true
  config.public_file_server.headers = {
    "Cache-Control" => "public, max-age=#{1.hour.to_i}"
  }

  # Show full error reports and disable caching.
  config.consider_all_requests_local       = true
  config.action_controller.perform_caching = false
  config.cache_store = :null_store

  # Render exception templates for rescuable exceptions and return status
  # code for other exceptions.
  config.action_dispatch.show_exceptions = false

  # Disable request forgery protection in test environment.
  config.action_controller.allow_forgery_protection = false

  # Print deprecation notices to the stderr.
  config.active_support.deprecation = :stderr

  # Raise exceptions for disallowed deprecations.
  config.active_support.disallowed_deprecation = :raise

  # Tell Active Support which deprecation messages to disallow.
  config.active_support.disallowed_deprecation_warnings = []

  # Raises error for missing translations.
  # config.i18n.raise_on_missing_translations = true

  # Annotate rendered view with file names.
  # config.action_view.annotate_rendered_view_with_filenames = true

  # Log level
  config.log_level = :warn

  # Disk service (see config/storage.yml) — no R2 credentials needed to run tests.
  config.active_storage.service = :test

  # Explicit, not the silent :async fallback — see production.rb's comment.
  config.active_job.queue_adapter = :test

  # Never let a test run rewrite schema.rb — it already can't reconstruct the
  # ai_interview Postgres schema (see rails_helper.rb), so it must not be trusted
  # as a source of truth.
  config.active_record.dump_schema_after_migration = false
end
