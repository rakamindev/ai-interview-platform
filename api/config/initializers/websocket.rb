# frozen_string_literal: true

# Mount WebSocket middlewares at the Rack level.
# These must be inserted BEFORE TenantResolverMiddleware so they can handle
# WebSocket upgrades before Rails routing runs.
#
# Path mapping:
#   /ws/sessions/:id/audio    → AudioWebSocketMiddleware  (binary audio proxy)
#   /ws/sessions/:id/coverage → CoverageWebSocketMiddleware (assessor live monitor)

Rails.autoloaders.main.ignore(Rails.root.join('app/channels/audio_websocket_middleware.rb'))
Rails.autoloaders.main.ignore(Rails.root.join('app/channels/coverage_websocket_middleware.rb'))

require_relative '../../app/channels/audio_websocket_middleware'
require_relative '../../app/channels/coverage_websocket_middleware'

Rails.application.config.middleware.insert_before TenantResolverMiddleware, AudioWebsocketMiddleware
Rails.application.config.middleware.insert_before TenantResolverMiddleware, CoverageWebsocketMiddleware
