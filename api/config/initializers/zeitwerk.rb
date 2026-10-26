# frozen_string_literal: true

# The WebSocket middlewares are named with the "WebSocket" acronym, which
# Zeitwerk cannot infer from their file names. Without this, eager loading
# (production, CI) aborts with `uninitialized constant AudioWebsocketMiddleware`.
Rails.autoloaders.main.inflector.inflect(
  'audio_websocket_middleware' => 'AudioWebSocketMiddleware',
  'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
)
