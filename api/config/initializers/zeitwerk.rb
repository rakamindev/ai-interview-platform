# frozen_string_literal: true

# The WebSocket middlewares spell "WebSocket" with a capital S, which Zeitwerk
# cannot derive from their file names. Without this mapping, eager loading
# (production, and test when CI is set) fails with
# "uninitialized constant AudioWebsocketMiddleware".
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
