# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe 'valid_transition?' do
    it 'allows not_yet → initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
    end

    it 'enforces the hard rule: cannot reach partial without probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'enforces the hard rule: cannot reach covered without probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'does not allow backwards or skipping transitions' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 5)).to be false
    end

    it 'freezes covered skills' do
      expect(described_class.valid_transition?(from: 'covered', to: 'covered', probe_count: 5)).to be false
    end
  end

  describe 'resolve_state' do
    it 'walks forward one step at a time through the gate' do
      # not_yet → proposed covered with probe 1: stops at initiated (can't skip / gate).
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)).to eq('initiated')
      # With probe 3 it can walk all the way to covered.
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3)).to eq('covered')
    end

    it 'ignores unknown proposed states' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'bogus', probe_count: 5)).to eq('partial')
    end

    it 'returns current state when proposed is behind' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'partial', probe_count: 5)).to eq('covered')
    end
  end
end
