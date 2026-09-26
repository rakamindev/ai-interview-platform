# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  describe 'event logging' do
    let(:client) { described_class.new(system_prompt: 'test', api_key: 'test-key') }
    let(:logged) { [] }

    before { allow(Rails.logger).to receive(:info) { |message| logged << message } }

    it 'logs how long the candidate spoke, never the words' do
      client.send(:log_gemini_event, 'serverContent' => { 'inputTranscription' => { 'text' => 'My name is Sekar and I live in Bandung' } })

      expect(logged.join).to include('inputTx=38 chars')
      expect(logged.join).not_to include('Sekar')
    end

    it 'logs how long the AI spoke, never the words' do
      client.send(:log_gemini_event, 'serverContent' => { 'outputTranscription' => { 'text' => 'Thanks Sekar, tell me more' } })

      expect(logged.join).to include('outputTx=26 chars')
      expect(logged.join).not_to include('Sekar')
    end
  end
end
