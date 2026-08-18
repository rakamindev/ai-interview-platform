# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebsocketMiddleware do
  subject(:middleware) { described_class.new(nil) }

  describe '#ai_closing_detected?' do
    def detect(text, language:)
      middleware.send(:ai_closing_detected?, text, language: language)
    end

    context 'when language is English' do
      it 'detects English closing phrases' do
        expect(detect('The team will review your application. You\'ll hear back from the team soon.', language: 'en')).to be true
        expect(detect('Thank you for your time today.', language: 'en')).to be true
        expect(detect('That concludes our interview, goodbye.', language: 'en')).to be true
        expect(detect('That\'s all for today. Good luck!', language: 'en')).to be true
        expect(detect('Thanks for your time.', language: 'en')).to be true
      end

      it 'does not trigger on non-matching text' do
        expect(detect('Can you tell me about your experience with Ruby?', language: 'en')).to be false
      end
    end

    context 'when language is Indonesian' do
      it 'detects Indonesian closing phrases' do
        expect(detect('Anda akan mendengar kabar dari tim kami.', language: 'id')).to be true
        expect(detect('Terima kasih atas waktu yang diberikan.', language: 'id')).to be true
        expect(detect('Semoga sukses!', language: 'id')).to be true
        expect(detect('Sampai jumpa.', language: 'id')).to be true
        expect(detect('Sesi wawancara ini telah selesai.', language: 'id')).to be true
        expect(detect('Wawancara kita sudah selesai, terima kasih.', language: 'id')).to be true
      end

      it 'does not trigger on non-matching text' do
        expect(detect('Ceritakan pengalaman Anda dengan Ruby.', language: 'id')).to be false
      end
    end

    context 'when language is not recognized' do
      it 'returns false' do
        expect(detect('Thank you for your time.', language: 'fr')).to be false
        expect(detect('Terima kasih atas waktu.', language: nil)).to be false
      end
    end
  end
end
