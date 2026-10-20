# frozen_string_literal: true

# The WebSocket middlewares are named AudioWebSocketMiddleware and
# CoverageWebSocketMiddleware, but Zeitwerk derives "AudioWebsocketMiddleware"
# from audio_websocket_middleware.rb. Without these rules, eager loading (on in
# production and in CI) fails with "uninitialized constant AudioWebsocketMiddleware"
# and the app can't boot.
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
