# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  describe '#sanitize_output_transcription' do
    let(:middleware) { described_class.new(nil) }

    def sanitize(text)
      middleware.send(:sanitize_output_transcription, text)
    end

    it 'strips coverage map JSON echoed by the model' do
      dirty = '[COVERAGE_MAP]{"skills":[{"label":"React","state":"covered"}]}[/COVERAGE_MAP] Let me ask about that.'
      expect(sanitize(dirty)).to eq('Let me ask about that.')
    end

    it 'strips TIME CONTROL signals that leak into transcription' do
      dirty = '[TIME CONTROL:SYS-TC-7x9k] { "wrap_up": true } Okay, thank you.'
      expect(sanitize(dirty)).to eq('Okay, thank you.')
    end

    it 'strips partial JSON echoes that precede the real sentence' do
      dirty = '"} ] And finally, tell me about testing.'
      expect(sanitize(dirty)).to eq('And finally, tell me about testing.')
    end

    it 'strips pacing metadata' do
      dirty = 'pacing=behind priority_next=react What else have you built?'
      expect(sanitize(dirty)).to eq('What else have you built?')
    end

    it 'keeps clean Indonesian speech untouched' do
      clean = 'Ceritakan pengalaman Anda memimpin tim.'
      expect(sanitize(clean)).to eq(clean)
    end
  end

  describe 'graceful-end gating' do
    let(:middleware) { described_class.new(nil) }
    let(:state) { described_class::ConnectionState.new }

    it 'arms the error-end timer on candidate-side close' do
      expect(middleware).to receive(:schedule_graceful_end)
      middleware.send(:handle_browser_close, double(code: 1006), double, state, 1)
    end

    it 'skips the error-end timer when the server cut the connection' do
      state.server_cut = true
      expect(middleware).not_to receive(:schedule_graceful_end)
      middleware.send(:handle_browser_close, double(code: 1006), double, state, 1)
    end

    describe '#grace_end_due?' do
      let(:session) { double(id: 1) }

      before do
        allow(session).to receive(:reload).and_return(double(ended?: false))
      end

      it 'is true when the candidate is gone and the session is not ended' do
        allow(Redis).to receive(:new).and_return(double(exists: false))
        expect(middleware.send(:grace_end_due?, session)).to be true
      end

      it 'is false while the session is still live (candidate reconnected on any worker)' do
        allow(Redis).to receive(:new).and_return(double(exists: true))
        expect(middleware.send(:grace_end_due?, session)).to be false
      end

      it 'is false when the session already ended' do
        allow(session).to receive(:reload).and_return(double(ended?: true))
        expect(middleware.send(:grace_end_due?, session)).to be false
      end
    end
  end
end