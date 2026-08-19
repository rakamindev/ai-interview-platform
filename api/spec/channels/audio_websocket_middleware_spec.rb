# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  subject(:middleware) { described_class.new(->(_env) { [404, {}, []] }) }

  describe '#gemini_api_key_configured?' do
    it 'rejects missing and placeholder keys' do
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('your_gemini_api_key')

      expect(middleware.send(:gemini_api_key_configured?)).to be(false)
    end

    it 'accepts a non-placeholder key' do
      allow(ENV).to receive(:[]).with('GEMINI_API_KEY').and_return('valid-local-test-key')

      expect(middleware.send(:gemini_api_key_configured?)).to be(true)
    end
  end

  describe '#handle_browser_message' do
    it 'forwards candidate answer completion to the Gemini client' do
      gemini_client = instance_double(Gemini::LiveClient, end_audio_stream: true)
      state = described_class::ConnectionState.new
      state.session = instance_double(Session, id: 123)
      state.gemini_client = gemini_client

      middleware.send(:handle_browser_message, { type: 'audio_stream_end' }.to_json, instance_double(Faye::WebSocket), state)

      expect(gemini_client).to have_received(:end_audio_stream)
    end
  end

  describe '#sanitize_output_transcription' do
    it 'removes leaked coverage JSON before saving or sending AI transcript text' do
      leaked = ', "discovered": [], "time_remaining_minutes": 15, "pacing": "ahead" ' \
               'That is a robust approach. How did you keep the experience consistent?'

      expect(middleware.send(:sanitize_output_transcription, leaked))
        .to eq('That is a robust approach. How did you keep the experience consistent?')
    end

    it 'removes leaked internal interviewer notes' do
      leaked = 'Internal interviewer note. Do not say, quote, summarize, or mention this note. ' \
               'Continue the interview naturally. How did you handle scale?'

      expect(middleware.send(:sanitize_output_transcription, leaked))
        .to eq('How did you handle scale?')
    end
  end
end
