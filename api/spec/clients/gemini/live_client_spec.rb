# frozen_string_literal: true

require 'rails_helper'
require 'faye/websocket'

RSpec.describe Gemini::LiveClient do
  let(:api_key) { 'test_live_api_key' }
  let(:model) { 'gemini-test-live-model' }
  let(:system_prompt) { 'You are a friendly AI interviewer.' }

  let(:on_audio_cb) { double('on_audio', call: nil) }
  let(:on_input_transcription_cb) { double('on_input_transcription', call: nil) }
  let(:on_output_transcription_cb) { double('on_output_transcription', call: nil) }
  let(:on_model_turn_complete_cb) { double('on_model_turn_complete', call: nil) }
  let(:on_go_away_cb) { double('on_go_away', call: nil) }
  let(:on_close_cb) { double('on_close', call: nil) }
  let(:on_error_cb) { double('on_error', call: nil) }
  let(:on_ready_cb) { double('on_ready', call: nil) }
  let(:on_resumption_token_update_cb) { double('on_resumption_token_update', call: nil) }

  let(:client) do
    described_class.new(
      system_prompt: system_prompt,
      api_key: api_key,
      model: model,
      on_audio: on_audio_cb,
      on_input_transcription: on_input_transcription_cb,
      on_output_transcription: on_output_transcription_cb,
      on_model_turn_complete: on_model_turn_complete_cb,
      on_go_away: on_go_away_cb,
      on_close: on_close_cb,
      on_error: on_error_cb,
      on_ready: on_ready_cb,
      on_resumption_token_update: on_resumption_token_update_cb
    )
  end

  let(:ws_mock) { instance_double(Faye::WebSocket::Client) }

  before do
    allow(Faye::WebSocket::Client).to receive(:new).and_return(ws_mock)
    allow(ws_mock).to receive(:on)
    allow(ws_mock).to receive(:send)
    allow(ws_mock).to receive(:close)
  end

  describe '#connect' do
    it 'initializes a WebSocket connection with the correct URL and headers' do
      expect(Faye::WebSocket::Client).to receive(:new).with(
        Gemini::LiveClient::GEMINI_WS_URL,
        nil,
        headers: { 'x-goog-api-key' => api_key }
      ).and_return(ws_mock)

      client.connect
    end

    it 'sets up event listeners' do
      expect(ws_mock).to receive(:on).with(:open)
      expect(ws_mock).to receive(:on).with(:message)
      expect(ws_mock).to receive(:on).with(:close)
      expect(ws_mock).to receive(:on).with(:error)

      client.connect
    end
  end

  describe 'WebSocket event handlers' do
    before { client.connect }

    # Helper to trigger callbacks set up via ws_mock.on
    def trigger_ws_event(event_name, data = nil)
      handler = nil
      allow(ws_mock).to receive(:on).with(event_name) do |&block|
        handler = block
      end
      # Re-invoke to capture the handler
      client.connect 
      
      case event_name
      when :open
        handler.call(double('event'))
      when :message
        handler.call(double('event', data: data))
      when :close
        handler.call(double('event', code: 1000, reason: 'Normal closure'))
      when :error
        handler.call(double('event', message: 'Test error'))
      end
    end

    describe 'on open' do
      it 'sends the setup message' do
        expect(ws_mock).to receive(:send).with(/setup/)
        trigger_ws_event(:open)
      end
    end

    describe 'on message' do
      context 'when receiving setupComplete' do
        it 'calls the on_ready callback' do
          expect(on_ready_cb).to receive(:call)
          trigger_ws_event(:message, { setupComplete: true }.to_json)
          expect(client.connected).to be(true)
        end
      end

      context 'when receiving audio response' do
        it 'decodes audio and calls on_audio callback' do
          audio_data = Base64.strict_encode64('test_audio_data')
          msg = {
            serverContent: {
              modelTurn: {
                parts: [
                  { inlineData: { data: audio_data } }
                ]
              }
            }
          }.to_json

          expect(on_audio_cb).to receive(:call).with('test_audio_data')
          trigger_ws_event(:message, msg)
        end
      end

      context 'when receiving transcriptions' do
        it 'buffers input transcription' do
          msg = {
            serverContent: {
              inputTranscription: { parts: [{ text: 'User says hello' }] }
            }
          }.to_json

          trigger_ws_event(:message, msg)
          # Internal state check since it buffers
          expect(client.instance_variable_get(:@input_text_buffer)).to eq('User says hello')
        end

        it 'buffers output transcription' do
          msg = {
            serverContent: {
              outputTranscription: { parts: [{ text: 'AI says hello back' }] }
            }
          }.to_json

          trigger_ws_event(:message, msg)
          expect(client.instance_variable_get(:@output_text_buffer)).to eq('AI says hello back')
        end
      end

      context 'when receiving generationComplete' do
        it 'flushes buffers and calls on_model_turn_complete' do
          # First buffer some input
          trigger_ws_event(:message, { serverContent: { inputTranscription: { text: 'test' } } }.to_json)
          
          expect(on_input_transcription_cb).to receive(:call).with('test')
          expect(on_model_turn_complete_cb).to receive(:call)
          
          trigger_ws_event(:message, { serverContent: { generationComplete: true } }.to_json)
        end
      end

      context 'when receiving goAway' do
        it 'calls on_go_away callback' do
          msg = { goAway: { timeLeft: '5s' } }.to_json
          expect(on_go_away_cb).to receive(:call).with(time_left: '5s', resumption_token: nil)
          trigger_ws_event(:message, msg)
        end
      end
    end

    describe 'on close' do
      it 'calls on_close callback' do
        expect(on_close_cb).to receive(:call).with(code: 1000, reason: 'Normal closure')
        trigger_ws_event(:close)
        expect(client.connected).to be(false)
      end
    end

    describe 'on error' do
      it 'calls on_error callback' do
        expect(on_error_cb).to receive(:call).with('Test error')
        trigger_ws_event(:error)
      end
    end
  end

  describe '#send_audio' do
    before do
      client.instance_variable_set(:@connected, true)
      client.instance_variable_set(:@ws, ws_mock)
    end

    it 'sends PCM bytes encoded in base64' do
      pcm_bytes = 'raw_pcm_data'
      expected_json = {
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: Base64.strict_encode64(pcm_bytes)
          }
        }
      }.to_json

      expect(ws_mock).to receive(:send).with(expected_json)
      client.send_audio(pcm_bytes)
    end
  end

  describe '#inject_context' do
    before do
      client.instance_variable_set(:@connected, true)
      client.instance_variable_set(:@ws, ws_mock)
    end

    it 'sends text via realtimeInput' do
      expected_json = { realtimeInput: { text: 'Some context' } }.to_json
      expect(ws_mock).to receive(:send).with(expected_json)
      expect(client.inject_context('Some context')).to be(true)
    end
  end

  describe '#close' do
    before do
      client.instance_variable_set(:@ws, ws_mock)
    end

    it 'closes the websocket and updates state' do
      expect(ws_mock).to receive(:close)
      client.close
      expect(client.connected).to be(false)
    end
  end
end
