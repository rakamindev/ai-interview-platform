# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe 'valid_transition?' do
    it 'enforces the hard rule: cannot advance past initiated without 2 probes' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'never moves backwards or skips states' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 9)).to be false
    end
  end

  describe 'resolve_state' do
    it 'walks forward one step at a time when Flash proposes a skip' do
      # not_yet → proposed partial with only 1 probe: the partial gate fails,
      # so it must stop at initiated.
      resolved = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 1)
      expect(resolved).to eq('initiated')
    end

    it 'walks to partial when probes are sufficient' do
      resolved = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 2)
      expect(resolved).to eq('partial')
    end

    it 'reaches partial when initiated has 2 probes and proposes partial' do
      resolved = described_class.resolve_state(current_state: 'initiated', proposed_state: 'partial', probe_count: 2)
      expect(resolved).to eq('partial')
    end

    it 'keeps current state when proposed state is unknown or lower' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'bogus', probe_count: 5)).to eq('partial')
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 5)).to eq('partial')
    end
  end
end
