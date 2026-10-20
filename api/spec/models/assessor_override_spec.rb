# frozen_string_literal: true

require 'rails_helper'

# AC-20: an assessor can rate a skill the AI didn't, but has to say where the rating comes from.
RSpec.describe AssessorOverride do
  let(:not_assessed) do
    create(:portfolio_skill, ai_level: nil, ai_confidence: nil, competency_summary: nil, evidence: [],
                             not_assessed_reason: 'not_reached')
  end

  it 'accepts a rating for a skill the AI did not rate, with a note' do
    override = build(:assessor_override, portfolio_skill: not_assessed, ai_level: nil, assessor_notes: 'Probed in round two')

    expect(override).to be_valid
  end

  it 'requires a note when there is no AI level to override' do
    override = build(:assessor_override, portfolio_skill: not_assessed, ai_level: nil, assessor_notes: ' ')

    expect(override).not_to be_valid
    expect(override.errors[:assessor_notes]).to be_present
  end

  it 'still lets an override of a rated skill go without a note' do
    expect(build(:assessor_override, assessor_notes: nil)).to be_valid
  end
end
