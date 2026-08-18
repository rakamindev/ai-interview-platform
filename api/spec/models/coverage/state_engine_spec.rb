# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet → initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
    end

    it 'enforces the probe_count >= 2 hard rule for partial and covered' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      expect(described_class.valid_transition?(from: 'partial',  to: 'covered', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'partial',  to: 'covered', probe_count: 2)).to be true
    end

    it 'never allows backwards or skipping transitions' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'covered', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'walks forward one step at a time when the model proposes multiple steps ahead' do
      result = described_class.resolve_state(current_state: 'initiated', proposed_state: 'covered', probe_count: 3)
      expect(result).to eq('covered') # via partial
    end

    it 'stops at the probe gate when walking' do
      result = described_class.resolve_state(current_state: 'initiated', proposed_state: 'covered', probe_count: 1)
      expect(result).to eq('initiated')
    end

    it 'returns current state for unknown or backward proposals' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 5)).to eq('partial')
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'bogus', probe_count: 5)).to eq('partial')
    end
  end
end