# frozen_string_literal: true

require "rails_helper"

# websocket-driver's default max_length is 64 MB per message; without an explicit
# cap one connection can make the server buffer that much before any of our code sees it.
RSpec.describe "WebSocket frame size limits" do
  def ws_env(path)
    {
      "REQUEST_METHOD" => "GET", "PATH_INFO" => path, "QUERY_STRING" => "", "SERVER_NAME" => "x", "SERVER_PORT" => "80",
      "HTTP_HOST" => "x", "HTTP_CONNECTION" => "Upgrade", "HTTP_UPGRADE" => "websocket",
      "HTTP_SEC_WEBSOCKET_VERSION" => "13", "HTTP_SEC_WEBSOCKET_KEY" => "dGhlIHNhbXBsZSBub25jZQ==",
      "rack.input" => StringIO.new
    }
  end

  let(:fake_ws) { instance_double(Faye::WebSocket, on: nil, rack_response: [200, {}, []]) }

  it "caps audio websocket messages" do
    allow(Faye::WebSocket).to receive(:new).and_return(fake_ws)

    AudioWebSocketMiddleware.new(nil).call(ws_env("/ws/sessions/1/audio"))

    expect(Faye::WebSocket).to have_received(:new).with(anything, nil, hash_including(max_length: a_value <= 4 * 1024 * 1024))
  end

  it "caps coverage websocket messages (server-push only, so tiny)" do
    allow(Faye::WebSocket).to receive(:new).and_return(fake_ws)

    CoverageWebSocketMiddleware.new(nil).call(ws_env("/ws/sessions/1/coverage"))

    expect(Faye::WebSocket).to have_received(:new).with(anything, nil, hash_including(max_length: a_value <= 64 * 1024))
  end
end
