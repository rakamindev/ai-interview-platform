# frozen_string_literal: true

require_relative 'boot'

require 'rails'
require 'active_model/railtie'
require 'active_record/railtie'
require 'action_controller/railtie'

require_relative '../app/middlewares/application_middleware'
require_relative '../app/middlewares/tenant_resolver_middleware'

Bundler.require(*Rails.groups)

module AiInterview
  class Application < Rails::Application
    config.load_defaults 7.0

    # API-only mode
    config.api_only = true

    # Auto-load paths
    config.autoload_paths += %W[
      #{config.root}/app/auth
      #{config.root}/app/lib
      #{config.root}/app/middlewares
      #{config.root}/app/services
      #{config.root}/app/channels
      #{config.root}/app/clients
      #{config.root}/app/workers
    ]

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
    # AuthTokenMiddleware is NOT global — controllers opt in via
    # `authorize_auth_token!` which adds a before_action per controller.

    config.middleware.use Rack::Attack
    config.middleware.use TenantResolverMiddleware

    # ActiveRecord Encryption keys, wired from ENV (this project keeps secrets
    # in config/application.yml via Figaro, not Rails credentials). Must be a
    # before_initialize hook, not a config/initializers/*.rb file — the
    # framework's own active_record.encryption initializer reads these values
    # earlier than app-level initializers run.
    config.before_initialize do
      config.active_record.encryption.primary_key         = ENV['ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY']
      config.active_record.encryption.deterministic_key   = ENV['ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY']
      config.active_record.encryption.key_derivation_salt = ENV['ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT']

      # Existing rows written before this feature shipped are plaintext. This
      # lets them keep reading correctly until the backfill migration
      # re-saves each one as ciphertext.
      config.active_record.encryption.support_unencrypted_data = true
    end
  end
end
