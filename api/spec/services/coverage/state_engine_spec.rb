# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'allows not_yet -> initiated with 0 probes' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
    end

    it 'blocks advancing past initiated when probe_count < 2 (HARD RULE)' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
      expect(described_class.valid_transition?(from: 'initiated', to: 'covered', probe_count: 1)).to be false
    end

    it 'allows initiated -> partial when probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
    end

    it 'allows partial -> covered when probe_count >= 2' do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 3)).to be true
    end

    it 'blocks backward transitions' do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 5)).to be false
    end
  end

  describe '.resolve_state' do
    it 'walks forward step by step obeying probe_count gates' do
      # Proposed state is covered, but probe_count is only 1 -> cannot pass initiated
      safe = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'covered',
        probe_count: 1
      )
      expect(safe).to eq('initiated')

      # Proposed state is covered with 2 probes -> can reach covered
      safe_covered = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'covered',
        probe_count: 2
      )
      expect(safe_covered).to eq('covered')
    end
  end
end
