# frozen_string_literal: true

Rails.autoloaders.each do |loader|
  loader.inflector.inflect(
    'audio_websocket_middleware' => 'AudioWebSocketMiddleware',
    'coverage_websocket_middleware' => 'CoverageWebSocketMiddleware'
  )
end
