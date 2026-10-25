# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet -> initiated' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
    end

    it 'blocks progression to partial if probe_count < 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
    end

    it 'allows initiated -> partial when probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'allows partial -> covered when probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'rejects backwards transitions' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 3)).to be false
    end

    it 'rejects direct leapfrogging without stepping through sequence' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'returns current_state when proposed state is identical' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 2)).to eq('partial')
    end

    it 'walks forward step by step if probe requirements are met' do
      # Proposing covered from not_yet with 3 probes walks: not_yet -> initiated -> partial -> covered
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 3)
      expect(result).to eq('covered')
    end

    it 'halts progression at initiated if probe_count < 2' do
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)
      expect(result).to eq('initiated')
    end

    it 'returns current_state if proposed state is backwards or invalid' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'not_yet', probe_count: 5)).to eq('covered')
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'invalid_state', probe_count: 5)).to eq('partial')
    end
  end
end
