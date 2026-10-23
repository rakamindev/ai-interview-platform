# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Coverage::StateEngine do
  describe '.resolve_state' do
    it 'does not advance to partial with fewer than two probes' do
      result = described_class.resolve_state(
        current_state: 'initiated',
        proposed_state: 'partial',
        probe_count: 1
      )

      expect(result).to eq('initiated')
    end

    it 'allows advancement to partial with two probes' do
      result = described_class.resolve_state(
        current_state: 'initiated',
        proposed_state: 'partial',
        probe_count: 2
      )

      expect(result).to eq('partial')
    end

    it 'advances through valid intermediate states when evidence is sufficient' do
      result = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'covered',
        probe_count: 2
      )

      expect(result).to eq('covered')
    end
  end
end
