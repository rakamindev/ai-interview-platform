# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet to initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
    end

    it 'rejects initiated to partial if probe_count < 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
    end

    it 'allows initiated to partial if probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'rejects backwards transition from covered to partial' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'returns current state if proposed state is unchanged' do
      state = described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3)
      expect(state).to eq('partial')
    end

    it 'walks forward safely from not_yet to partial when probe_count >= 2' do
      state = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 2)
      expect(state).to eq('partial')
    end

    it 'stops at initiated if probe_count < 2 when Flash proposes covered' do
      state = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)
      expect(state).to eq('initiated')
    end
  end
end
