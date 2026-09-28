# frozen_string_literal: true

# "WebSocket" is intentionally camel-cased as two words in these middleware
# class names, while the existing filenames use `websocket` as one word.
Rails.autoloaders.main.inflector.inflect(
  'audio_websocket_middleware' => 'AudioWebSocketMiddleware',
  'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
)
