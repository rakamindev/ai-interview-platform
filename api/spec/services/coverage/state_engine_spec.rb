# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows only the next forward transition' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be(true)
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 3)).to be(false)
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 3)).to be(false)
    end

    it 'requires at least two probes before partial or covered' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be(true)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be(true)
    end
  end

  describe '.resolve_state' do
    it 'walks through valid intermediate states without skipping' do
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)).to eq('initiated')
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 2)).to eq('covered')
    end

    it 'does not regress or accept an unknown proposed state' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 3)).to eq('partial')
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'invalid', probe_count: 3)).to eq('partial')
    end

    it 'keeps the current state when no change is proposed' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'covered', probe_count: 5)).to eq('covered')
    end
  end
end
