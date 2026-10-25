# frozen_string_literal: true

# Mount WebSocket middlewares at the Rack level.
# These must be inserted BEFORE TenantResolverMiddleware so they can handle
# WebSocket upgrades before Rails routing runs.
#
# Path mapping:
#   /ws/sessions/:id/audio    → AudioWebsocketMiddleware  (binary audio proxy)
#   /ws/sessions/:id/coverage → CoverageWebsocketMiddleware (assessor live monitor)

require_relative '../../app/channels/audio_websocket_middleware'
require_relative '../../app/channels/coverage_websocket_middleware'

Rails.application.config.middleware.insert_before TenantResolverMiddleware, AudioWebsocketMiddleware
Rails.application.config.middleware.insert_before TenantResolverMiddleware, CoverageWebsocketMiddleware
