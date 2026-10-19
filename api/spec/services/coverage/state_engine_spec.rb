# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine, type: :service do
  describe ".valid_transition?" do
    it "allows not_yet to initiated with 0 probes" do
      expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be(true)
    end

    it "rejects initiated to partial if probe_count < 2" do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be(false)
    end

    it "allows initiated to partial if probe_count >= 2" do
      expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be(true)
    end

    it "allows partial to covered if probe_count >= 2" do
      expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be(true)
    end

    it "rejects backward transitions" do
      expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 3)).to be(false)
      expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 3)).to be(false)
    end
  end

  describe ".resolve_state" do
    it "resolves a multi-step jump safely according to probe count" do
      # If AI jumps from not_yet to covered with 1 probe, it should only advance to initiated
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 1)
      expect(result).to eq('initiated')

      # If AI jumps from not_yet to covered with 2 probes, it advances through initiated to partial, then covered
      result = described_class.resolve_state(current_state: 'not_yet', proposed_state: 'covered', probe_count: 2)
      expect(result).to eq('covered')
    end

    it "keeps state unchanged if proposed state is backward or invalid" do
      result = described_class.resolve_state(current_state: 'partial', proposed_state: 'initiated', probe_count: 2)
      expect(result).to eq('partial')
    end
  end
end
