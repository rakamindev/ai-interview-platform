# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine, type: :model do
  describe '.valid_transition?' do
    context 'valid transitions' do
      it 'allows not_yet → initiated' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
      end

      it 'allows initiated → partial with probe_count >= 2' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      end

      it 'allows partial → covered with probe_count >= 2' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
      end
    end

    context 'invalid transitions' do
      it 'rejects not_yet → partial' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 3)).to be false
      end

      it 'rejects not_yet → covered' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 3)).to be false
      end

      it 'rejects initiated → covered' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'covered', probe_count: 3)).to be false
      end

      it 'rejects covered → any state' do
        expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      end
    end

    context 'probe_count gating' do
      it 'rejects initiated → partial with probe_count < 2' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      end

      it 'rejects partial → covered with probe_count < 2' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      end
    end

    context 'unknown states' do
      it 'rejects unknown from state' do
        expect(described_class.valid_transition?(from: 'unknown', to: 'initiated', probe_count: 0)).to be false
      end

      it 'rejects unknown to state' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'unknown', probe_count: 0)).to be false
      end
    end
  end

  describe '.resolve_state' do
    it 'returns current state when proposed equals current' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'not_yet', probe_count: 0)
      expect(result).to eq('not_yet')
    end

    it 'advances one step when possible' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 0)
      expect(result).to eq('initiated')
    end

    it 'advances multiple steps when probe_count allows' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3)
      expect(result).to eq('covered')
    end

    it 'stays at current state when probe_count insufficient' do
      result = described_class.resolve_state(current_state: 'initiated', proposed_state: 'covered', probe_count: 1)
      expect(result).to eq('initiated')
    end

    it 'returns current state for unknown proposed state' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'unknown', probe_count: 0)
      expect(result).to eq('not_yet')
    end

    it 'returns current state for backward transition' do
      result = described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 5)
      expect(result).to eq('partial')
    end
  end

  describe 'constants' do
    it 'defines STATES in correct order' do
      expect(described_class::STATES).to eq(%w[not_yet initiated partial covered])
    end

    it 'defines VALID_TRANSITIONS' do
      expect(described_class::VALID_TRANSITIONS).to eq({
        'not_yet'   => %w[initiated],
        'initiated' => %w[partial],
        'partial'   => %w[covered],
        'covered'   => []
      })
    end
  end
end
