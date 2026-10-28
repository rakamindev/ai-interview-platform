# frozen_string_literal: true

# The WebSocket middlewares spell "WebSocket" with a capital S, which Zeitwerk
# cannot infer from the file names. Without this, eager loading (production,
# and CI) fails with "uninitialized constant AudioWebsocketMiddleware".
Rails.autoloaders.main.inflector.inflect(
  'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
  'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
)
