# frozen_string_literal: true

# Zeitwerk derives AudioWebsocketMiddleware from audio_websocket_middleware.rb,
# but the classes spell it AudioWebSocketMiddleware. Nothing noticed because
# development never eager loads — production does, so the app raised NameError
# on boot there. Surfaced by CI, which eager loads via ENV["CI"].
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
