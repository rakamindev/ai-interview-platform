# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TranscriptIntegrity do
  describe '.check' do
    context 'with a coherent English transcript' do
      it 'marks it verified' do
        text = 'Payflow is a payment platform I led. We rebuilt the checkout with React and TypeScript. ' \
               'The biggest challenge was keeping state consistent under heavy traffic.'
        result = described_class.check(text)
        expect(result.verified?).to be true
        expect(result.reason).to be_nil
      end
    end

    context 'with a transcript dominated by STT hallucination' do
      it 'marks it unverifiable with :noise' do
        text = (['水', '응', 'मशहूर', 'unsinn', 'Sí', 'sí'] * 12).join(' ')
        result = described_class.check(text)
        expect(result.unverifiable?).to be true
        expect(result.reason).to eq(:noise)
      end
    end

    context 'with a transcript that is mostly gibberish fragments' do
      it 'marks it unverifiable with :not_english' do
        text = (['de', 'si', 'is', 'of', 'é', 'think'] * 12).join(' ')
        result = described_class.check(text)
        expect(result.unverifiable?).to be true
        expect(result.reason).to eq(:not_english)
      end
    end

    context 'with an almost empty transcript' do
      it 'marks it unverifiable with :too_short' do
        result = described_class.check('')
        expect(result.unverifiable?).to be true
        expect(result.reason).to eq(:too_short)
      end
    end

    context 'with a short but plausible answer' do
      it 'marks it too short' do
        result = described_class.check('Yes, I do.')
        expect(result.unverifiable?).to be true
        expect(result.reason).to eq(:too_short)
      end
    end
  end
end