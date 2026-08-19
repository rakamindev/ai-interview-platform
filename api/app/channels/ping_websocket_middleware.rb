# frozen_string_literal: true

require 'faye/websocket'

# Rack middleware at /ws/speed_test — echoes back whatever it receives, nothing else.
# Used only to measure real WebSocket round-trip latency/jitter ahead of an interview,
# over the same transport stack (Puma + EventMachine + faye-websocket) as
# AudioWebSocketMiddleware, without opening a session or a Gemini connection.
class PingWebSocketMiddleware
  PING_PATH = '/ws/speed_test'

  def initialize(app)
    @app = app
  end

  def call(env)
    return @app.call(env) unless env['PATH_INFO'] == PING_PATH && Faye::WebSocket.websocket?(env)

    handle_ping_websocket(env)
  end

  private

  def handle_ping_websocket(env)
    ws = Faye::WebSocket.new(env, nil, ping: nil)

    ws.on(:message) { |event| ws.send(event.data) }

    ws.rack_response
  end
end
