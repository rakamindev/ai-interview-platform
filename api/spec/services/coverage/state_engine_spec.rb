# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe 'valid_transition?' do
    it 'allows the first step into a skill without demanding probes yet' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be(true)
    end

    it 'rejects a multi-step jump even when the probe gate is met' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 5)).to be(false)
    end

    it 'rejects an unknown target state' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'wrapped_up', probe_count: 5)).to be(false)
    end

    it 'rejects a backward transition' do
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 5)).to be(false)
    end

    it 'gates every step past initiated on the probe count of exactly two' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be(true)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be(false)
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be(true)
    end

    it 'never leaves the terminal covered state' do
      described_class::STATES.drop(1).each do |target|
        expect(described_class.valid_transition?(from: 'covered', to: target, probe_count: 10)).to be(false)
      end
    end
  end

  describe 'resolve_state' do
    it 'applies a single forward step the analyzer proposed' do
      resolved = described_class.resolve_state(
        current_state: 'initiated', proposed_state: 'partial', probe_count: 2
      )

      expect(resolved).to eq('partial')
    end

    it 'walks a multi-step proposal forward one state at a time' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet', proposed_state: 'covered', probe_count: 2
      )

      expect(resolved).to eq('covered')
    end

    it 'stops the walk at the last state the probe gate allows' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet', proposed_state: 'covered', probe_count: 1
      )

      expect(resolved).to eq('initiated')
    end

    it 'leaves the state untouched for a state the model invented' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet', proposed_state: 'excellent', probe_count: 4
      )

      expect(resolved).to eq('not_yet')
    end

    it 'leaves the state untouched for a nil proposal' do
      resolved = described_class.resolve_state(
        current_state: 'partial', proposed_state: nil, probe_count: 4
      )

      expect(resolved).to eq('partial')
    end

    it 'keeps the probe gate as the only way past initiated' do
      blocked = described_class.resolve_state(
        current_state: 'not_yet', proposed_state: 'partial', probe_count: 0
      )
      allowed = described_class.resolve_state(
        current_state: 'initiated', proposed_state: 'partial', probe_count: 2
      )

      expect(blocked).to eq('initiated')
      expect(allowed).to eq('partial')
    end

    it 'is a no-op when the proposal matches the current state' do
      expect(
        described_class.resolve_state(current_state: 'covered', proposed_state: 'covered', probe_count: 9)
      ).to eq('covered')
      expect(
        described_class.resolve_state(current_state: 'not_yet', proposed_state: 'not_yet', probe_count: 0)
      ).to eq('not_yet')
    end
  end
end
