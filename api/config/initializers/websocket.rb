# frozen_string_literal: true

# Mount WebSocket middlewares at the Rack level.
# These must be inserted BEFORE TenantResolverMiddleware so they can handle
# WebSocket upgrades before Rails routing runs.
#
# Loaded explicitly here so the middleware exists before the Rack stack is
# built. The file name and class name must stay in sync (Zeitwerk derives
# AudioWebsocketMiddleware from audio_websocket_middleware.rb) or eager
# loading in production fails.
require_relative '../../app/channels/audio_websocket_middleware'
require_relative '../../app/channels/coverage_websocket_middleware'
#
# Path mapping:
#   /ws/sessions/:id/audio    → AudioWebsocketMiddleware  (binary audio proxy)
#   /ws/sessions/:id/coverage → CoverageWebsocketMiddleware (assessor live monitor)

Rails.application.config.middleware.insert_before TenantResolverMiddleware, AudioWebsocketMiddleware
Rails.application.config.middleware.insert_before TenantResolverMiddleware, CoverageWebsocketMiddleware
