# frozen_string_literal: true

# `app/channels/audio_websocket_middleware.rb` defines `AudioWebSocketMiddleware`,
# but Zeitwerk's default inflector camelizes the "websocket" filename segment to
# "Websocket" (lowercase 's'), not "WebSocket". This was never caught because
# eager loading has never run in this repo (off in development, on only when
# ENV["CI"] is set, and CI has never existed until this session's test harness).
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
