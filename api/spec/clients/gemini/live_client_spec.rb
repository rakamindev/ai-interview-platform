# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  let(:system_prompt) { 'Test system prompt' }
  let(:mock_ws) do
    instance_double(Faye::WebSocket::Client, on: nil)
  end

  before do
    allow(Faye::WebSocket::Client).to receive(:new).and_return(mock_ws)
  end

  describe 'GEMINI_WS_URL' do
    it 'has the default Google Gemini Live endpoint' do
      default_url = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
      expect(described_class::GEMINI_WS_URL).to eq(ENV.fetch('GEMINI_WS_URL', default_url))
    end
  end

  describe '#connect' do
    context 'when session_id is not provided' do
      it 'connects to GEMINI_WS_URL directly' do
        client = described_class.new(system_prompt: system_prompt, api_key: 'test-key')
        client.connect

        expect(Faye::WebSocket::Client).to have_received(:new).with(
          described_class::GEMINI_WS_URL,
          nil,
          headers: { 'x-goog-api-key' => 'test-key' }
        )
      end
    end

    context 'when session_id is provided (real endpoint, no mock override)' do
      it 'does NOT append session_id — the real Gemini endpoint rejects it' do
        client = described_class.new(system_prompt: system_prompt, session_id: '42', api_key: 'test-key')
        client.connect

        expect(Faye::WebSocket::Client).to have_received(:new).with(
          described_class::GEMINI_WS_URL,
          nil,
          headers: { 'x-goog-api-key' => 'test-key' }
        )
      end
    end

    context 'when GEMINI_WS_URL is overridden in ENV' do
      around do |example|
        old_val = ENV['GEMINI_WS_URL']
        ENV['GEMINI_WS_URL'] = 'ws://localhost:8080/ws'
        example.run
      ensure
        ENV['GEMINI_WS_URL'] = old_val
      end

      it 'connects to the overridden URL with session_id query param' do
        client = described_class.new(system_prompt: system_prompt, session_id: 'e2e-session-123', api_key: 'test-key')
        client.connect

        expect(Faye::WebSocket::Client).to have_received(:new).with(
          'ws://localhost:8080/ws?session_id=e2e-session-123',
          nil,
          headers: { 'x-goog-api-key' => 'test-key' }
        )
      end

      it 'appends token if token is also provided' do
        client = described_class.new(
          system_prompt: system_prompt,
          session_id: '42',
          token: 'e2e-token-resumption',
          api_key: 'test-key'
        )
        client.connect

        expect(Faye::WebSocket::Client).to have_received(:new).with(
          'ws://localhost:8080/ws?session_id=42&token=e2e-token-resumption',
          nil,
          headers: { 'x-goog-api-key' => 'test-key' }
        )
      end
    end

    context 'when GEMINI_WS_URL is overridden with the production Google endpoint' do
      around do |example|
        old_val = ENV['GEMINI_WS_URL']
        ENV['GEMINI_WS_URL'] = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
        example.run
      ensure
        ENV['GEMINI_WS_URL'] = old_val
      end

      it 'does NOT append session_id or token query params' do
        client = described_class.new(
          system_prompt: system_prompt,
          session_id: 'e2e-session-123',
          token: 'e2e-token-live-gemini',
          api_key: 'test-key'
        )
        client.connect

        expect(Faye::WebSocket::Client).to have_received(:new).with(
          ENV['GEMINI_WS_URL'],
          nil,
          headers: { 'x-goog-api-key' => 'test-key' }
        )
      end
    end
  end
end
