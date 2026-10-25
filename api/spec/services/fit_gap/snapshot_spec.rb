require 'rails_helper'

RSpec.describe FitGap::Snapshot do
  it 'rejects malformed, missing, fractional, and out-of-range ratings instead of coercing them' do
    [nil, '', 'L3', '3cats', '3.0', 3.5, true, {}, [], 0, 6].each do |value|
      expect(described_class.level(value)).to be_nil
    end
    expect(described_class.level('3')).to eq(3)
    expect(described_class.level(5)).to eq(5)
  end
end
