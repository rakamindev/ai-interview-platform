# frozen_string_literal: true

# Mount WebSocket middlewares at the Rack level.
# These must be inserted BEFORE TenantResolverMiddleware so they can handle
# WebSocket upgrades before Rails routing runs.
#
# Path mapping:
#   /ws/sessions/:id/audio    → AudioWebSocketMiddleware  (binary audio proxy)
#   /ws/sessions/:id/coverage → CoverageWebSocketMiddleware (assessor live monitor)
#
# They live in lib/, outside the autoload paths, because they are loaded once
# at boot and never reloaded (the Rails autoloading guide recommends this).

require_relative '../../lib/middleware/audio_websocket_middleware'
require_relative '../../lib/middleware/coverage_websocket_middleware'

Rails.application.config.middleware.insert_before TenantResolverMiddleware, AudioWebSocketMiddleware
Rails.application.config.middleware.insert_before TenantResolverMiddleware, CoverageWebSocketMiddleware
