# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet → initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
    end

    it 'allows initiated → partial with probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'rejects initiated → partial with probe_count < 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
    end

    it 'allows partial → covered with probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 3)).to be true
    end

    it 'rejects partial → covered with probe_count < 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
    end

    it 'rejects covered → anything' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
    end

    it 'rejects backward transitions' do
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 5)).to be false
    end

    it 'rejects skip transitions (not_yet → partial)' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 3)).to be false
    end
  end

  describe '.resolve_state' do
    it 'returns same state when proposed equals current' do
      result = described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3)
      expect(result).to eq('partial')
    end

    it 'advances one step at a time' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 1)
      expect(result).to eq('initiated') # Only advances one step because probe_count < 2 for partial
    end

    it 'advances through all steps when probe_count is sufficient' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 5)
      expect(result).to eq('covered')
    end

    it 'stops at initiated when probe_count is insufficient for partial' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)
      expect(result).to eq('initiated') # Can reach initiated (probe >= 0) but not partial (probe < 2)
    end

    it 'returns current state for unknown proposed state' do
      result = described_class.resolve_state(current_state: 'partial', proposed_state: 'unknown', probe_count: 3)
      expect(result).to eq('partial')
    end

    it 'does not go backward' do
      result = described_class.resolve_state(current_state: 'covered', proposed_state: 'not_yet', probe_count: 5)
      expect(result).to eq('covered')
    end
  end
end
