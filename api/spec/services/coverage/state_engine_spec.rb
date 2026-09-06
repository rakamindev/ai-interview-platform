# frozen_string_literal: true

require 'rails_helper'

# Pins the two rules from PRD 01 section 4: forward one step at a time, and
# nothing past `initiated` on fewer than 2 probes.
RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows the forward step out of not_yet regardless of probe count' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
    end

    it 'refuses to advance past initiated on a single probe' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
    end

    it 'allows initiated to partial once two probes have happened' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'refuses to skip a step' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 9)).to be false
    end

    it 'refuses to move backwards' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 9)).to be false
    end
  end

  describe '.resolve_state' do
    it 'walks a multi step proposal forward one step at a time' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3)

      expect(result).to eq('covered')
    end

    it 'stops at the first gate the probe count fails' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)

      expect(result).to eq('initiated')
    end

    it 'ignores a proposal that moves backwards' do
      result = described_class.resolve_state(current_state: 'covered', proposed_state: 'not_yet', probe_count: 5)

      expect(result).to eq('covered')
    end

    it 'ignores an unknown proposed state' do
      result = described_class.resolve_state(current_state: 'partial', proposed_state: 'nonsense', probe_count: 5)

      expect(result).to eq('partial')
    end
  end
end
