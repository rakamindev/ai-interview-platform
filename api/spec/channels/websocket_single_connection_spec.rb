# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Audio websocket single-connection guard" do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization), status: "pending", ended_at: nil) }
  let(:middleware) { AudioWebSocketMiddleware.new(nil) }
  let(:ws) { instance_double(Faye::WebSocket, send: nil, close: nil) }
  let(:env) { { "QUERY_STRING" => "token=#{session.invite_token}", "rack.input" => StringIO.new } }

  it "rejects a second connection for the same interview with a recoverable error and never starts Gemini" do
    lock = instance_double(AudioConnectionLock, acquire: false)
    allow(AudioConnectionLock).to receive(:new).and_return(lock)
    expect(middleware).not_to receive(:connect_to_gemini)

    middleware.send(:handle_browser_open, env, session.id.to_s, ws, AudioWebSocketMiddleware::ConnectionState.new)

    expect(ws).to have_received(:send).with(a_string_including("already_connected", '"recoverable":true'))
    expect(ws).to have_received(:close)
  end

  it "holds the lock for the connection and releases it when the browser disconnects" do
    lock = instance_double(AudioConnectionLock, acquire: true, release: nil)
    allow(AudioConnectionLock).to receive(:new).and_return(lock)
    allow(middleware).to receive(:connect_to_gemini)
    allow(EM).to receive(:add_periodic_timer).and_return(double(cancel: nil))
    state = AudioWebSocketMiddleware::ConnectionState.new

    middleware.send(:handle_browser_open, env, session.id.to_s, ws, state)
    allow(middleware).to receive(:schedule_graceful_end)
    middleware.send(:handle_browser_close, double(code: 1000), ws, state, session.id.to_s)

    expect(lock).to have_received(:release)
  end

  it "does not let a rejected second tab release the first tab's lock when it closes" do
    lock = instance_double(AudioConnectionLock, acquire: false, release: nil)
    allow(AudioConnectionLock).to receive(:new).and_return(lock)
    allow(middleware).to receive(:schedule_graceful_end)
    state = AudioWebSocketMiddleware::ConnectionState.new

    middleware.send(:handle_browser_open, env, session.id.to_s, ws, state)
    middleware.send(:handle_browser_close, double(code: 1000), ws, state, session.id.to_s)

    expect(lock).not_to have_received(:release)
  end
end
