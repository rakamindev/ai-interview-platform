# frozen_string_literal: true

# The websocket middlewares spell "WebSocket" with a capital S, which Zeitwerk
# can't infer from the file names. Without this, eager loading (production, and
# test when CI is set) fails with "uninitialized constant AudioWebsocketMiddleware".
Rails.autoloaders.main.inflector.inflect(
  'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
  'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
)
