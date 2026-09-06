# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:app) { ->(env) { [200, {}, ['OK']] } }
  let(:middleware) { described_class.new(app) }
  let(:state) { described_class::ConnectionState.new }
  let(:browser_ws) { instance_double('Faye::WebSocket', send: true, close: true) }
  let(:gemini_client) { instance_double('Gemini::LiveClient', accepting_audio?: false, connected: false, send_audio: true, trigger_opening: true) }

  describe 'ConnectionState' do
    it 'initializes with empty audio_buffer' do
      expect(state.audio_buffer).to eq([])
      expect(state.reconnecting).to be(false)
      expect(state.model_speaking).to be(false)
    end
  end

  describe '#forward_audio_frame' do
    let(:session_id) { '123' }
    let(:sample_audio) { "\x00\x01\x02\x03".b }

    context 'when model is speaking' do
      before do
        state.model_speaking = true
        state.gemini_client = gemini_client
      end

      it 'suppresses audio to prevent feedback loop' do
        expect(gemini_client).not_to receive(:send_audio)
        middleware.send(:forward_audio_frame, sample_audio, state, session_id)
        expect(state.audio_buffer).to be_empty
      end
    end

    context 'when gemini is ready and accepting audio' do
      before do
        state.model_speaking = false
        state.gemini_client = gemini_client
        allow(gemini_client).to receive(:accepting_audio?).and_return(true)
      end

      it 'forwards audio chunk directly to gemini client' do
        expect(gemini_client).to receive(:send_audio).with(sample_audio)
        middleware.send(:forward_audio_frame, sample_audio, state, session_id)
        expect(state.audio_buffer).to be_empty
      end
    end

    context 'when gemini is reconnecting / not ready (AC-1 Zero Audio Drop)' do
      before do
        state.model_speaking = false
        state.gemini_client = gemini_client
        allow(gemini_client).to receive(:accepting_audio?).and_return(false)
      end

      it 'buffers incoming audio frames into audio_buffer' do
        expect(gemini_client).not_to receive(:send_audio)
        middleware.send(:forward_audio_frame, sample_audio, state, session_id)
        expect(state.audio_buffer).to eq([sample_audio])
      end

      it 'caps buffer size at AUDIO_BUFFER_MAX_CHUNKS to prevent memory leaks' do
        described_class::AUDIO_BUFFER_MAX_CHUNKS.times do |i|
          state.audio_buffer << "chunk_#{i}".b
        end

        middleware.send(:forward_audio_frame, sample_audio, state, session_id)
        expect(state.audio_buffer.size).to eq(described_class::AUDIO_BUFFER_MAX_CHUNKS)
      end
    end
  end

  describe '#build_on_ready buffer replay' do
    let(:session) { double('Session', id: 42, gemini_resumption_token: 'tok_123') }

    before do
      state.session = session
      state.gemini_client = gemini_client
      state.reconnecting = true
    end

    it 'flushes all buffered audio chunks to Gemini upon reconnect in order' do
      chunk1 = 'audio_part_1'.b
      chunk2 = 'audio_part_2'.b
      state.audio_buffer = [chunk1, chunk2]

      expect(gemini_client).to receive(:send_audio).with(chunk1).ordered
      expect(gemini_client).to receive(:send_audio).with(chunk2).ordered

      on_ready_callback = middleware.send(:build_on_ready, browser_ws, state, session)
      allow(middleware).to receive(:schedule_proactive_reconnect)
      allow(middleware).to receive(:send_json)

      on_ready_callback.call

      expect(state.audio_buffer).to be_empty
      expect(state.reconnecting).to be(false)
    end
  end

  describe '#handle_go_away graceful handoff (AC-2)' do
    let(:session) { double('Session', id: 42) }
    let(:old_client) { instance_double('Gemini::LiveClient', supersede!: true, close: true) }

    before do
      state.session = session
      state.gemini_client = old_client
      state.model_speaking = true
      allow(session).to receive(:update_column).with(:gemini_resumption_token, 'resumption_token_xyz')
      allow(middleware).to receive(:send_json)
      allow(middleware).to receive(:build_gemini_client)
      allow(state).to receive(:gemini_client).and_return(old_client, gemini_client)
      allow(gemini_client).to receive(:connect)
    end

    it 'initiates new connection without prematurely closing old client or killing model speech' do
      expect(old_client).to receive(:supersede!)
      expect(old_client).not_to receive(:close) # Must NOT close synchronously
      expect(EM).to receive(:add_timer).with(1) # Grace period timer scheduled

      middleware.send(:handle_go_away, browser_ws, state, 'resumption_token_xyz')

      expect(state.reconnecting).to be(true)
      expect(state.latest_resumption_token).to eq('resumption_token_xyz')
      expect(state.model_speaking).to be(true) # model_speaking remains active during graceful handoff
    end
  end
end
