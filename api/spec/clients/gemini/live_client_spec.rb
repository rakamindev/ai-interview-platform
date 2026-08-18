# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Gemini::LiveClient do
  # redact_transcript is a pure function; allocate avoids standing up a socket.
  subject(:client) { described_class.allocate }

  let(:spoken) { 'Saya bekerja di PT Contoh sebagai backend developer sejak 2021.' }

  describe '#redact_transcript' do
    it 'keeps candidate speech out of the log by default' do
      expect(client.send(:redact_transcript, spoken)).not_to include('PT Contoh')
    end

    it 'still reports length, so turn boundaries stay debuggable' do
      expect(client.send(:redact_transcript, spoken)).to include("#{spoken.length}ch")
    end

    it 'gives identical text an identical digest, so duplicate turns stay visible' do
      expect(client.send(:redact_transcript, spoken))
        .to eq(client.send(:redact_transcript, spoken.dup))
    end

    it 'gives different text a different digest' do
      expect(client.send(:redact_transcript, spoken))
        .not_to eq(client.send(:redact_transcript, "#{spoken} Dan juga Flutter."))
    end

    context 'when LOG_TRANSCRIPT_TEXT is explicitly enabled' do
      before { stub_const('ENV', ENV.to_h.merge('LOG_TRANSCRIPT_TEXT' => 'true')) }

      it 'logs the words for local debugging' do
        expect(client.send(:redact_transcript, spoken)).to include('PT Contoh')
      end
    end
  end
end
