# frozen_string_literal: true

require 'rails_helper'

# AC-B4: transcript text must never appear in INFO logs.
# This is the seeded fault test (AC-T1b): if the transcript snippet logging in
# log_gemini_event is reintroduced, this spec fails.
RSpec.describe Gemini::LiveClient do
  describe '#log_gemini_event' do
    let(:client) do
      described_class.new(system_prompt: 'test', api_key: 'test', model: 'test-model')
    end

    def captured_log
      output = StringIO.new
      original_logger = Rails.logger
      Rails.logger = Logger.new(output)
      yield
      output.string
    ensure
      Rails.logger = original_logger
    end

    it 'does not write candidate or AI transcript text into logs (AC-B4)' do
      log = captured_log do
        client.send(:log_gemini_event, {
          'serverContent' => {
            'inputTranscription'  => { 'text' => 'MY_SECRET_CANDIDATE_ANSWER' },
            'outputTranscription' => { 'text' => 'MY_SECRET_AI_QUESTION' }
          }
        })
      end

      expect(log).not_to include('MY_SECRET_CANDIDATE_ANSWER')
      expect(log).not_to include('MY_SECRET_AI_QUESTION')
    end

    it 'still logs a non-content signal for debuggability' do
      log = captured_log do
        client.send(:log_gemini_event, {
          'serverContent' => {
            'inputTranscription' => { 'text' => 'hello world' }
          }
        })
      end

      expect(log).to include('inputTx=')
    end
  end
end