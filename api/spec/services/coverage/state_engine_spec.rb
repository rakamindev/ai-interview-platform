# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet to advance to initiated with 1 probe' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
    end

    it 'rejects advancing to partial if probe_count < 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
    end

    it 'allows advancing from initiated to partial if probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'allows advancing from partial to covered if probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'rejects backward transitions' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 3)).to be false
    end
  end

  describe '.resolve_state' do
    it 'returns current state if proposed is unchanged' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: 'initiated', probe_count: 1)).to eq('initiated')
    end

    it 'does not skip steps if probe count is insufficient' do
      # proposed skip to partial, but probe_count is only 1
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 1)
      expect(result).to eq('initiated')
    end

    it 'safely walks forward when probe count allows it' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 2)
      expect(result).to eq('partial')
    end
  end
end
