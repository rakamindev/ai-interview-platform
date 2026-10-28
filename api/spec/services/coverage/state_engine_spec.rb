# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    it 'rejects transition to covered when fewer than two probes exist' do
      expect(
        described_class.valid_transition?(
          from: 'partial',
          to: 'covered',
          probe_count: 1
        )
      ).to be(false)
    end

    it 'allows transition to covered when at least two probes exist' do
      expect(
        described_class.valid_transition?(
          from: 'partial',
          to: 'covered',
          probe_count: 2
        )
      ).to be(true)
    end
  end

  describe '.resolve_state' do
    it 'does not skip to covered when probe count is insufficient' do
      expect(
        described_class.resolve_state(
          current_state: 'partial',
          proposed_state: 'covered',
          probe_count: 1
        )
      ).to eq('partial')
    end
  end
end
