# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet → initiated regardless of probe count' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be(true)
    end

    it 'blocks initiated → partial below 2 probes' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be(false)
    end

    it 'allows initiated → partial at 2 probes' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be(true)
    end

    it 'rejects backward and skip transitions' do
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 9)).to be(false)
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 9)).to be(false)
    end
  end

  describe '.resolve_state' do
    it 'walks forward one step and stops at the probe gate' do
      expect(
        described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1),
      ).to eq('initiated')
    end

    it 'walks fully forward when probes allow' do
      expect(
        described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 2),
      ).to eq('covered')
    end

    it 'never moves backward' do
      expect(
        described_class.resolve_state(current_state: 'partial', proposed_state: 'not_yet', probe_count: 9),
      ).to eq('partial')
    end

    it 'ignores unknown proposed states' do
      expect(
        described_class.resolve_state(current_state: 'not_yet', proposed_state: 'bogus', probe_count: 9),
      ).to eq('not_yet')
    end
  end
end
