# frozen_string_literal: true

# The WebSocket middleware files are named *_websocket_middleware.rb but define *WebSocketMiddleware.
# Without this mapping, eager loading (production, CI) raises NameError at boot.
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
