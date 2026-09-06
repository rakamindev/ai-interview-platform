# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  let(:client) do
    described_class.new(
      system_prompt: 'Test Prompt',
      on_audio: ->(_) {},
      on_input_transcription: ->(_) {},
      on_output_transcription: ->(_) {},
      on_model_turn_complete: -> {}
    )
  end

  describe '#log_gemini_event' do
    it 'redacts candidate and AI transcript text to character length to prevent PII leakage' do
      raw_payload = {
        'serverContent' => {
          'inputTranscription' => {
            'parts' => [{ 'text' => 'My secret company revenue was 500 million' }]
          },
          'outputTranscription' => {
            'parts' => [{ 'text' => 'Understood, tell me more about that architecture.' }]
          }
        }
      }

      expect(Rails.logger).to receive(:info) do |log_message|
        expect(log_message).to include('inputTx=[41 chars]')
        expect(log_message).to include('outputTx=[49 chars]')
        expect(log_message).not_to include('secret company revenue')
        expect(log_message).not_to include('Understood, tell me more')
      end

      client.send(:log_gemini_event, raw_payload)
    end
  end
end
