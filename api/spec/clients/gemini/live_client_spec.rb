# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  class FakeWebSocket
    attr_reader :messages

    def initialize
      @messages = []
    end

    def send(payload)
      @messages << payload
    end
  end

  describe '#send_setup' do
    it 'uses the supported native-audio live model and turn-taking VAD settings' do
      client = described_class.new(system_prompt: 'Interview the candidate.', api_key: 'test-key')
      ws = FakeWebSocket.new
      client.instance_variable_set(:@ws, ws)

      client.send(:send_setup)

      payload = JSON.parse(ws.messages.last)
      setup = payload.fetch('setup')

      expect(setup.fetch('model')).to eq('models/gemini-2.5-flash-native-audio-latest')
      expect(setup.dig('generationConfig', 'responseModalities')).to eq(['AUDIO'])
      expect(setup.dig('realtimeInputConfig', 'automaticActivityDetection', 'silenceDurationMs')).to eq(900)
      expect(setup.dig('realtimeInputConfig', 'turnCoverage')).to eq('TURN_INCLUDES_ONLY_ACTIVITY')
      expect(setup.fetch('sessionResumption')).to eq({})
    end
  end

  describe '#end_audio_stream' do
    it 'sends audioStreamEnd so Gemini can respond when the candidate clicks done answering' do
      client = described_class.new(system_prompt: 'Interview the candidate.', api_key: 'test-key')
      ws = FakeWebSocket.new
      client.instance_variable_set(:@ws, ws)
      client.instance_variable_set(:@connected, true)

      client.end_audio_stream

      expect(JSON.parse(ws.messages.last)).to eq('realtimeInput' => { 'audioStreamEnd' => true })
    end

    it 'does not send when the live connection is not ready' do
      client = described_class.new(system_prompt: 'Interview the candidate.', api_key: 'test-key')
      ws = FakeWebSocket.new
      client.instance_variable_set(:@ws, ws)
      client.instance_variable_set(:@connected, false)

      client.end_audio_stream

      expect(ws.messages).to be_empty
    end
  end
end
