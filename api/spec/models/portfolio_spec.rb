# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  it 'accepts the four generation statuses used by the assessor contract' do
    Portfolio::GENERATION_STATUSES.each do |status|
      record = described_class.new(generation_status: status)
      record.validate
      expect(record.errors[:generation_status]).to be_blank
    end
  end

  it 'rejects an unknown generation status' do
    record = described_class.new(generation_status: 'empty')
    record.validate
    expect(record.errors[:generation_status]).to be_present
  end

  it 'exposes failed? / complete? / generating? for controller branching' do
    expect(described_class.new(generation_status: 'failed')).to be_failed
    expect(described_class.new(generation_status: 'complete')).to be_complete
    expect(described_class.new(generation_status: 'generating')).to be_generating
    expect(described_class.new(generation_status: 'pending')).not_to be_generating
  end
end
