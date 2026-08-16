# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AudioWebSocketMiddleware do
  let(:middleware) { described_class.new(->(_env) { [200, {}, []] }) }

  describe '#ai_closing_detected?' do
    it 'detects a closing phrase in the final sentence' do
      expect(middleware.send(:ai_closing_detected?, 'Thank you for your time.')).to be(true)
      expect(middleware.send(:ai_closing_detected?, 'That concludes our interview, good luck!')).to be(true)
    end

    it 'ignores a closing phrase in the middle of a longer turn' do
      text = "Good luck with that. Now let's move on to the next question."
      expect(middleware.send(:ai_closing_detected?, text)).to be(false)
    end

    it 'does not treat a turn that ends with a question as closing' do
      text = 'Thank you for your time. Do you have any questions for us?'
      expect(middleware.send(:ai_closing_detected?, text)).to be(false)
    end

    it 'still matches Indonesian partial phrases' do
      text = 'Anda akan mendengar kabar dari tim rekrutmen kami.'
      expect(middleware.send(:ai_closing_detected?, text)).to be(true)
    end
  end

  describe 'grace timer registry' do
    it 'cancels and removes a registered timer' do
      fake = double(cancel: nil)
      described_class.register_grace_timer(123, fake)

      expect(fake).to receive(:cancel)
      described_class.cancel_grace_timer(123)

      expect(described_class::GRACE_TIMERS).not_to have_key(123)
    end
  end
end
