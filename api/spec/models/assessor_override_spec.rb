# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  def build_override(**attrs)
    described_class.new(
      {
        ai_level: 3,
        override_level: 4,
        overridden_by: 1,
        assessor_notes: 'Seen stronger system design in the interview.'
      }.merge(attrs)
    )
  end

  it 'accepts a level in 1..5 with an auditor id' do
    record = build_override
    record.validate
    expect(record.errors[:override_level]).to be_blank
    expect(record.errors[:overridden_by]).to be_blank
  end

  it 'rejects override_level outside 1..5' do
    record = build_override(override_level: 9)
    record.validate
    expect(record.errors[:override_level]).to be_present
  end

  it 'requires overridden_by for audit' do
    record = build_override(overridden_by: nil)
    record.validate
    expect(record.errors[:overridden_by]).to be_present
  end

  it 'allows long assessor notes (no silent truncation)' do
    record = build_override(assessor_notes: 'x' * 4_000)
    record.validate
    expect(record.errors[:assessor_notes]).to be_blank
  end
end
