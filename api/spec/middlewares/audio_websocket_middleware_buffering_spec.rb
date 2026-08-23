# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:middleware) { described_class.new(nil) }
  let(:state) { AudioWebSocketMiddleware::ConnectionState.new }
  let(:gemini_client) { double('GeminiClient', accepting_audio?: false, connected: false, send_audio: nil) }
  let(:session_id) { 'sess-123' }

  before { state.gemini_client = gemini_client }

  describe '#forward_audio_frame' do
    context 'when Gemini is not ready (reconnect gap)' do
      it 'buffers the frame for replay instead of dropping it' do
        middleware.send(:forward_audio_frame, "pcm#{'x' * 100}", state, session_id)

        expect(state.audio_buffer.count).to eq(1)
      end
    end

    context 'when Gemini is accepting audio' do
      let(:gemini_client) { double('GeminiClient', accepting_audio?: true, send_audio: nil) }

      it 'forwards directly and does not buffer' do
        middleware.send(:forward_audio_frame, 'pcm', state, session_id)

        expect(gemini_client).to have_received(:send_audio).with('pcm')
        expect(state.audio_buffer.count).to eq(0)
      end
    end

    context 'when the model is speaking (echo gate)' do
      let(:state_with_gate) do
        state.model_speaking = true
        state
      end

      it 'suppresses without buffering' do
        middleware.send(:forward_audio_frame, 'pcm', state_with_gate, session_id)

        expect(state_with_gate.audio_buffer.count).to eq(0)
      end
    end
  end

  describe '#replay_buffered_audio' do
    it 'sends buffered chunks in order and clears the buffer' do
      state.audio_buffer.push('chunk-1', timestamp: 1.0)
      state.audio_buffer.push('chunk-2', timestamp: 2.0)

      middleware.send(:replay_buffered_audio, state)

      expect(gemini_client).to have_received(:send_audio).with('chunk-1').ordered
      expect(gemini_client).to have_received(:send_audio).with('chunk-2').ordered
      expect(state.audio_buffer.count).to eq(0)
    end

    it 'is a no-op with an empty buffer' do
      middleware.send(:replay_buffered_audio, state)

      expect(gemini_client).not_to have_received(:send_audio)
    end
  end

  describe '#build_on_ready' do
    it 'replays buffered audio when reconnecting' do
      browser_ws = double('BrowserWS', send: nil)
      session = double('Session', id: 1, gemini_resumption_token: 'tok')
      allow(middleware).to receive(:schedule_proactive_reconnect)
      allow(middleware).to receive(:send_json)

      state.reconnecting = true
      state.session = session
      state.gemini_client = double('GeminiClient', trigger_opening: nil, send_audio: nil)
      state.audio_buffer.push('late-frame', timestamp: 1.0)

      on_ready = middleware.send(:build_on_ready, browser_ws, state, session)
      on_ready.call

      expect(state.gemini_client).to have_received(:send_audio).with('late-frame')
      expect(state.audio_buffer.count).to eq(0)
    end
  end
end
