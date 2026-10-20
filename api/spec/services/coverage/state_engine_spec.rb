# frozen_string_literal: true

require 'rails_helper'

# Pure function: no database, no network, no model client. These specs run in
# milliseconds and stay green even when every external dependency is down,
# which is exactly why they are the right place to pin down the PRD-01 rules.
RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet to move to initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
    end

    it 'allows initiated to move to partial once there have been two probes' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'allows partial to move to covered once there have been two probes' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'refuses to skip straight from initiated to covered' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'covered', probe_count: 5)).to be false
    end

    it 'refuses to skip straight from not_yet to partial' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 5)).to be false
    end

    it 'refuses any further transition once covered' do
      described_class::VALID_TRANSITIONS['covered'].each do |target|
        expect(described_class.valid_transition?(from: 'covered', to: target, probe_count: 9)).to be false
      end
    end

    context 'with the hard rule from PRD-01' do
      it 'refuses to advance past initiated on a single probe' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      end

      it 'refuses to reach covered on a single probe' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      end

      it 'refuses a negative probe count' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 0)).to be false
      end
    end

    context 'with input the analyzer should never produce' do
      it 'refuses an unknown source state' do
        expect(described_class.valid_transition?(from: 'nonsense', to: 'partial', probe_count: 9)).to be false
      end

      it 'refuses a nil target state' do
        expect(described_class.valid_transition?(from: 'not_yet', to: nil, probe_count: 9)).to be false
      end
    end
  end

  describe '.resolve_state' do
    it 'keeps the current state when the proposal is the same' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3))
        .to eq('partial')
    end

    it 'walks forward one step at a time instead of jumping' do
      # The analyzer is allowed to propose covered from not_yet. The engine must
      # only advance as far as the transition rules actually permit.
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 5))
        .to eq('covered')
    end

    it 'stops at initiated when there has only been one probe' do
      expect(described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1))
        .to eq('initiated')
    end

    it 'never moves a skill backwards' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'not_yet', probe_count: 9))
        .to eq('covered')
    end

    it 'holds the current state when the proposal is an unknown state' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: 'bogus', probe_count: 9))
        .to eq('initiated')
    end

    it 'holds the current state when the proposal is nil' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: nil, probe_count: 9))
        .to eq('initiated')
    end
  end
end