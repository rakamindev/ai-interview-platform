# frozen_string_literal: true

# Make Zeitwerk map `audio_websocket_middleware.rb` → `AudioWebSocketMiddleware`
# (capital S), matching how the class is actually defined and referenced.
# Without this, eager loading (config.eager_load=true — CI and production)
# looks up the default inflected name `AudioWebsocketMiddleware`, which the
# file never defines, and boot fails with
# `uninitialized constant AudioWebsocketMiddleware`.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
