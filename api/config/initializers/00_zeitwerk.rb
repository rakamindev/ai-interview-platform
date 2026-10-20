# frozen_string_literal: true

# These files are named "*_websocket_*" but define "*WebSocket*" classes. Zeitwerk derives
# "Websocket" from the file name, so with eager loading (production, CI) boot failed with
# "uninitialized constant AudioWebsocketMiddleware". Tell the inflector the real names.
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
