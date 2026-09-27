# frozen_string_literal: true

# The WebSocket middlewares spell "WebSocket" with a capital S, but Zeitwerk derives
# "Websocket" from the file names. Development loads lazily and never notices; production
# eager-loads app/ and failed to boot with `uninitialized constant AudioWebsocketMiddleware`.
# Verify with: bin/rails zeitwerk:check
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
