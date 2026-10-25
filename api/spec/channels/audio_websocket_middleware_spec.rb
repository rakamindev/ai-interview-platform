# frozen_string_literal: true

require_relative '../spec_helper'

# ModelManifest reads these via ENV.fetch at require time.
ENV['GEMINI_LIVE_MODEL'] ||= 'gemini-live-test'
ENV['GEMINI_FLASH_MODEL'] ||= 'gemini-flash-test'
ENV['GEMINI_PRO_MODEL'] ||= 'gemini-pro-test'

require 'eventmachine'
require_relative '../../config/initializers/model_manifest'
require_relative '../../app/channels/audio_websocket_middleware'

RSpec.describe AudioWebSocketMiddleware do
  class FakeBrowserWs
    attr_reader :sent_frames

    def initialize(open: true)
      @open = open
      @sent_frames = []
      @closed = false
    end

    def open? = @open
    def closed? = @closed
    def send(frame) = @sent_frames << frame
    def close = @closed = true
  end

  after do
    described_class::CONNECTIONS_MONITOR.synchronize { described_class::CONNECTIONS.clear }
  end

  def register(session_id, ws)
    described_class::CONNECTIONS_MONITOR.synchronize { described_class::CONNECTIONS[session_id] = ws }
  end

  def registered(session_id)
    described_class::CONNECTIONS_MONITOR.synchronize { described_class::CONNECTIONS[session_id] }
  end

  # Runs the block on a live EventMachine reactor just long enough (0.6s) for the
  # delayed close timer (0.3s) inside close_session_locally to fire.
  def run_in_reactor
    EM.run do
      yield
      EM.add_timer(0.6) { EM.stop }
    end
  end

  it 'closes the local connection and unregisters it on a close_session control message' do
    ws = FakeBrowserWs.new
    register(42, ws)

    run_in_reactor do
      described_class.handle_control_message({ 'event' => 'close_session', 'session_id' => 42 })
    end

    expect(registered(42)).to be_nil
    payload = JSON.parse(ws.sent_frames.first)
    expect(payload['type']).to eq('session_ended')
    expect(ws.closed?).to be true
  end

  it 'is a no-op for a session whose connection lives in another process' do
    expect do
      run_in_reactor do
        described_class.handle_control_message({ 'event' => 'close_session', 'session_id' => 999 })
      end
    end.not_to raise_error
    expect(registered(999)).to be_nil
  end

  it 'unregisters but sends nothing when the socket is already closed' do
    ws = FakeBrowserWs.new(open: false)
    register(5, ws)

    expect do
      described_class.handle_control_message({ 'event' => 'close_session', 'session_id' => 5 })
    end.not_to raise_error
    expect(ws.sent_frames).to be_empty
    expect(registered(5)).to be_nil
  end

  it 'ignores malformed control payloads' do
    expect { described_class.handle_control_message('garbage') }.not_to raise_error
    expect { described_class.handle_control_message(nil) }.not_to raise_error
  end

  it 'closes locally AND broadcasts the command when asked to close a session' do
    ws = FakeBrowserWs.new
    register(7, ws)
    allow(described_class).to receive(:publish_control_command)

    run_in_reactor do
      described_class.close_session(7)
    end

    expect(JSON.parse(ws.sent_frames.first)['type']).to eq('session_ended')
    expect(ws.closed?).to be true
    expect(described_class).to have_received(:publish_control_command)
      .with({ event: 'close_session', session_id: 7 })
  end
end
