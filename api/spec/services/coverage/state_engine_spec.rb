# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/coverage/state_engine'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows valid forward transitions when probe count conditions are met' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 3)).to be true
    end

    it 'rejects transition to partial or covered if probe_count < 2 (Hard Rule)' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 0)).to be false
    end

    it 'rejects backward or skipping transitions directly' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 2)).to be false
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'returns current state if proposed state is identical' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3)).to eq('partial')
    end

    it 'safely walks forward multiple steps if probe count allows' do
      # from not_yet directly proposed covered with probe_count 3: walks not_yet -> initiated -> partial -> covered
      resolved = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3)
      expect(resolved).to eq('covered')
    end

    it 'stops at initiated if probe_count < 2 even if covered is proposed' do
      # from not_yet directly proposed covered, but probe_count is only 1: must stop at initiated
      resolved = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)
      expect(resolved).to eq('initiated')
    end

    it 'does not allow backward transition' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'partial', probe_count: 1)).to eq('covered')
    end
  end
end
