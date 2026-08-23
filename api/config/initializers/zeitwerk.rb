# frozen_string_literal: true

# Fix: audio_websocket_middleware.rb → AudioWebSocketMiddleware (capital S).
# Standard Zeitwerk convention converts "websocket" → "Websocket", but the
# class uses the correct English spelling "WebSocket" (proper noun).
Rails.application.config.autoload_paths
Rails.application.config.to_prepare do
  Rails.autoloaders.each do |autoloader|
    autoloader.inflector.inflect(
      "audio_websocket_middleware" => "AudioWebSocketMiddleware"
    )
  end
end
