# frozen_string_literal: true

require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"

require_relative "../app/middlewares/application_middleware"
require_relative "../app/middlewares/correlation_id_middleware"
require_relative "../app/middlewares/tenant_resolver_middleware"

Bundler.require(*Rails.groups)

module AiInterview
  class Application < Rails::Application
    config.load_defaults 8.0

    # API-only mode
    config.api_only = true

    # Never auto-rewrite db/schema.rb after migrations: Rails 8.1 dumps the
    # cross-schema `public.organizations` table AFTER the add_foreign_key
    # block, so a re-dump breaks `db:schema:load`/`db:prepare` on a fresh DB
    # (PG::UndefinedTable). schema.rb is maintained manually — see
    # lib/tasks/force_migrate.rake and docs/08-migration-safety.md.
    config.active_record.dump_schema_after_migration = false

    # Enable Action Mailer (needed for AssessmentMailer)
    config.action_mailer.default_url_options = { host: ENV.fetch("MAILER_HOST", "localhost"), port: ENV.fetch("MAILER_PORT", 3000) }

    # Auto-load paths
    config.autoload_paths.push(
      "#{config.root}/app/auth",
      "#{config.root}/app/lib",
      "#{config.root}/app/middlewares",
      "#{config.root}/app/services",
      "#{config.root}/app/channels",
      "#{config.root}/app/clients",
      "#{config.root}/app/workers",
      "#{config.root}/app/mailers",
      "#{config.root}/app/serializers"
    )

    # Use UUID primary keys by default
    config.generators do |g|
      g.orm :active_record, primary_key_type: :uuid
    end

    # ── Middleware stack ────────────────────────────────────────────────────────
    #
    # Order matters:
    #   1. Rack::Attack            — rate limiting (before everything else)
    #   2. Rack::Cors              — CORS headers (configured in config/initializers/cors.rb)
    #   3. TenantResolverMiddleware— decodes JWT scheme claim → sets Current.organization
    #                               + Current.tenant_id for every request.
    #
    # Controllers opt in via `authorize_auth_token!` which adds a before_action.

    config.middleware.use Rack::Attack
    config.middleware.use ActionDispatch::Cookies
    config.middleware.use CorrelationIdMiddleware
    config.middleware.use TenantResolverMiddleware
  end
end
