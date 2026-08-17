# frozen_string_literal: true

# The two WebSocket middlewares are named with a capital S — AudioWebSocketMiddleware,
# CoverageWebSocketMiddleware — while their files are audio_websocket_middleware.rb and
# coverage_websocket_middleware.rb. Zeitwerk derives "AudioWebsocketMiddleware" from that
# filename and raises NameError when the constant it finds does not match.
#
# Nothing surfaced this until eager loading was switched on. config/initializers/websocket.rb
# require_relative's both files, which defines the constants through a path Zeitwerk does not
# police, so lazy loading never consulted the inflector at all. Under eager loading — CI, and
# production — Zeitwerk walks app/channels itself and the mismatch aborts boot.
#
# Teaching the inflector the acronym keeps both the filenames and the constant names as they
# are. Renaming either one would have been the larger change to reason about.
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect(
    "audio_websocket_middleware" => "AudioWebSocketMiddleware",
    "coverage_websocket_middleware" => "CoverageWebSocketMiddleware"
  )
end
