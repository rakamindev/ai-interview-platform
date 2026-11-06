# frozen_string_literal: true

# The files are named *_websocket_middleware.rb but the classes are
# *WebSocketMiddleware. Without these inflections, eager loading (production, CI)
# fails with NameError.
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
