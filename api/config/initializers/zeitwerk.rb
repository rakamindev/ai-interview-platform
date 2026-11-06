# frozen_string_literal: true

# Nama file memakai "websocket", sedangkan kelasnya ditulis "WebSocket".
# Tanpa inflection ini, Zeitwerk mengharapkan AudioWebsocketMiddleware dan boot
# dengan eager_load (production, CI) gagal dengan NameError (F-22).
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    'audio_websocket_middleware'    => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
