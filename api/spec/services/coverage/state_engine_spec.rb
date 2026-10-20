# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows one step forward when the probe gate is met' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be(true)
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be(true)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be(true)
    end

    it 'enforces the PRD hard rule: no advance past initiated with fewer than 2 probes' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be(false)
    end

    it 'rejects skipping states, moving backwards, and leaving covered' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 5)).to be(false)
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 5)).to be(false)
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be(false)
    end

    it 'rejects unknown states' do
      expect(described_class.valid_transition?(from: 'bogus', to: 'initiated', probe_count: 5)).to be(false)
    end
  end

  describe '.resolve_state' do
    it 'walks forward step by step when the model proposes a jump' do
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3))
        .to eq('covered')
    end

    it 'stops at the last state the probe gate allows' do
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1))
        .to eq('initiated')
    end

    it 'never moves backwards' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 9))
        .to eq('partial')
    end

    it 'ignores an unknown proposed state' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: 'done', probe_count: 9))
        .to eq('initiated')
    end

    it 'returns the current state when nothing changes' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 0))
        .to eq('partial')
    end
  end
end
