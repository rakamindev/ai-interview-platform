# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.resolve_state' do
    it 'handles not_yet -> initiated' do
      res = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'initiated', probe_count: 1)
      expect(res).to eq('initiated')
    end

    it 'walks not_yet -> partial when probe_count >= 2' do
      res = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 2)
      expect(res).to eq('partial')
    end

    it 'blocks not_yet -> partial at initiated when probe_count < 2' do
      res = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'partial', probe_count: 1)
      expect(res).to eq('initiated')
    end

    it 'blocks initiated -> partial when probe_count < 2' do
      res = described_class.resolve_state(current_state: 'initiated', proposed_state: 'partial', probe_count: 1)
      expect(res).to eq('initiated')
    end

    it 'allows initiated -> partial when probe_count >= 2' do
      res = described_class.resolve_state(current_state: 'initiated', proposed_state: 'partial', probe_count: 2)
      expect(res).to eq('partial')
    end

    it 'walks initiated -> covered when probe_count >= 2' do
      res = described_class.resolve_state(current_state: 'initiated', proposed_state: 'covered', probe_count: 2)
      expect(res).to eq('covered')
    end

    it 'freezes covered state' do
      res = described_class.resolve_state(current_state: 'covered', proposed_state: 'partial', probe_count: 5)
      expect(res).to eq('covered')
    end
  end

  describe '.valid_transition?' do
    it 'returns true for valid transitions' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
    end

    it 'returns false for invalid transitions' do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 2)).to be false
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 2)).to be false
    end
  end
end
