# frozen_string_literal: true

require 'rails_helper'

# StateEngine is the gate that decides whether a skill may advance toward
# `covered`. Everything downstream — the confidence a portfolio claims, and
# therefore whether a hiring decision is defensible — rests on it.
RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows the forward step out of not_yet regardless of probe_count' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
    end

    it 'refuses to skip a step' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 9)).to be false
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 9)).to be false
    end

    it 'never moves backwards' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 9)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 9)).to be false
    end

    # PRD 01: "A skill CANNOT advance past 'initiated' unless probe_count >= 2.
    # Even if the first answer was exceptional."
    context 'the two-probe hard rule' do
      it 'blocks initiated -> partial below two probes' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      end

      it 'permits initiated -> partial at exactly two probes' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      end

      it 'blocks partial -> covered below two probes' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      end
    end

    it 'rejects states outside the vocabulary' do
      expect(described_class.valid_transition?(from: 'covered', to: 'discovered', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'nonsense', to: 'covered', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'is a no-op when the model proposes the state already held' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3))
        .to eq('partial')
    end

    it 'ignores a proposal to move backwards' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'not_yet', probe_count: 0))
        .to eq('covered')
    end

    it 'ignores an unrecognised proposal rather than guessing' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: 'banana', probe_count: 5))
        .to eq('initiated')
    end

    # Flash regularly proposes a state two or three steps ahead. Walking the
    # ladder one rung at a time keeps the probe_count gate applied at each rung
    # instead of letting a single confident model response skip it.
    context 'when the model proposes a state several steps ahead' do
      it 'walks only as far as the probe_count permits' do
        expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1))
          .to eq('initiated')
      end

      it 'walks the whole ladder once the gate is satisfied' do
        expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 2))
          .to eq('covered')
      end
    end
  end
end
