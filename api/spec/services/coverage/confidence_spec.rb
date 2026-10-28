# frozen_string_literal: true

require 'rails_helper'

# AC3: confidence follows the PRD rule (PRD-01, "ASSIGN CONFIDENCE"), computed from the coverage
# map, never taken from the model. Where the PRD rules overlap, the weaker label wins.
RSpec.describe Coverage::Confidence do
  [
    # state,       probes, expected
    ['covered',    3,      'high'],
    ['covered',    7,      'high'],
    ['covered',    2,      'medium'],  # overlap: covered but only 2 probes
    ['partial',    2,      'medium'],
    ['partial',    5,      'medium'],
    ['initiated',  1,      'low'],
    ['initiated',  4,      'low'],     # overlap: many probes but still only initiated
    ['covered',    1,      'low'],     # inconsistent data: weakest rule wins
    ['partial',    0,      'low']
  ].each do |state, probes, expected|
    it "is #{expected} for #{state} with #{probes} probe(s)" do
      expect(described_class.for(state: state, probe_count: probes)).to eq(expected)
    end
  end

  it 'is nil for not_yet, because nothing was measured' do
    expect(described_class.for(state: 'not_yet', probe_count: 0)).to be_nil
  end
end
