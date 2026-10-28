# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  describe '#handle_setup_complete' do
    it 'calls on_ready only once for repeated setupComplete events' do
      on_ready = double('on_ready')
      client = described_class.new(
        system_prompt: 'Test prompt',
        api_key: 'test-key',
        on_ready: on_ready
      )

      expect(on_ready).to receive(:call).once

      2.times do
        client.send(:handle_setup_complete, 'setupComplete' => {})
      end
    end
  end

  describe '#trigger_opening' do
    it 'sends a completed user text turn through clientContent' do
      client = described_class.allocate
      websocket = double('WebSocket')

      client.instance_variable_set(:@connected, true)
      client.instance_variable_set(:@ws, websocket)

      expect(websocket).to receive(:send) do |payload|
        message = JSON.parse(payload)

        expect(message).to have_key('clientContent')
        expect(message['clientContent']['turnComplete']).to be(true)
        expect(message['clientContent']['turns'].first['role']).to eq('user')
        expect(message['clientContent']['turns'].first['parts'].first['text'])
          .to include('Greet the candidate and ask your first question')
      end

      client.trigger_opening
    end

    it 'does not send a message when disconnected' do
      client = described_class.allocate
      client.instance_variable_set(:@connected, false)
      client.instance_variable_set(:@ws, double('WebSocket'))

      expect(client.instance_variable_get(:@ws)).not_to receive(:send)

      client.trigger_opening
    end
  end
  describe 'sensitive data logging' do
    it 'does not log candidate or model transcription content' do
      client = described_class.allocate
      candidate_text = 'CANDIDATE_PRIVATE_TEXT_123'
      model_text = 'MODEL_PRIVATE_TEXT_456'

      expect(Rails.logger).to receive(:info) do |message|
        expect(message).not_to include(candidate_text)
        expect(message).not_to include(model_text)
      end

      client.send(
        :log_gemini_event,
        'serverContent' => {
          'inputTranscription' => { 'text' => candidate_text },
          'outputTranscription' => { 'text' => model_text }
        }
      )
    end

    it 'does not log the session resumption token but still forwards it' do
      client = described_class.allocate
      token = 'PRIVATE_RESUMPTION_TOKEN_789'
      callback = double('resumption callback')

      client.instance_variable_set(:@on_resumption_token_update, callback)

      expect(Rails.logger).to receive(:debug) do |message|
        expect(message).not_to include(token)
      end
      expect(callback).to receive(:call).with(token)

      client.send(
        :handle_resumption_update,
        'sessionResumption' => { 'newHandle' => token }
      )

      expect(client.resumption_token).to eq(token)
    end
  end

end
