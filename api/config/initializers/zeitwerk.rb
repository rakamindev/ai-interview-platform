# frozen_string_literal: true

# The WebSocket middlewares are named "WebSocket" but live in *_websocket_*.rb
# files. Without this mapping Zeitwerk expects AudioWebsocketMiddleware, and
# eager loading (production, and CI via config/environments/test.rb) fails at boot.
Rails.autoloaders.main.inflector.inflect(
  'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
  'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
)
