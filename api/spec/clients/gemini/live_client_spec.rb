# frozen_string_literal: true

require 'rails_helper'

# UU PDP data minimisation (finding F-DATA-4): what the candidate says must never reach the logs.
# The log line may say that a transcription arrived, never its content.
RSpec.describe Gemini::LiveClient do
  describe 'event logging' do
    let(:client)  { described_class.allocate } # log_gemini_event needs no connection state
    let(:speech)  { 'my name is Test Candidate and my phone is 0812-0000-0000' }
    let(:reply)   { 'Thanks, Test Candidate. Tell me about your last project.' }
    let(:logged)  { [] }

    before { allow(Rails.logger).to receive(:info) { |message| logged << message } }

    def log(server_content)
      client.send(:log_gemini_event, { 'serverContent' => server_content })
    end

    it 'records that a transcription arrived, but not what the candidate or the AI said' do
      log('inputTranscription' => { 'text' => speech }, 'outputTranscription' => { 'text' => reply })

      output = logged.join("\n")
      expect(output).to include('inputTx').and include('outputTx')
      expect(output).not_to include('Test Candidate')
      expect(output).not_to include('0812')
    end

    it 'still logs the non-personal turn markers used for debugging' do
      log('turnComplete' => true, 'interrupted' => true)

      expect(logged.join).to include('turnComplete').and include('interrupted')
    end
  end
end
