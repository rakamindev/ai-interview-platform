# frozen_string_literal: true

# Zeitwerk's default camelization turns `audio_websocket_middleware` into
# `AudioWebsocketMiddleware`, but the middleware classes use the conventional
# `WebSocket` spelling. Register the acronym so eager loading in CI resolves
# the same constants as the explicit requires in config/initializers/websocket.rb.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
