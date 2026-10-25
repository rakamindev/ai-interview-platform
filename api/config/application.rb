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
    autoload_dirs = %W[
      #{config.root}/app/auth
      #{config.root}/app/lib
      #{config.root}/app/middlewares
      #{config.root}/app/services
      #{config.root}/app/channels
      #{config.root}/app/clients
      #{config.root}/app/workers
    ]
    config.autoload_paths = (config.autoload_paths + autoload_dirs).uniq

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
  end
end
