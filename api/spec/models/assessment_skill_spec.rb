# frozen_string_literal: true

require 'rails_helper'

# A skill must not be selectable twice within the same assessment — the UI
# picker used to show already-selected skills and the backend accepted dupes.
RSpec.describe AssessmentSkill, type: :model do
  it 'rejects a duplicate skill label within the same assessment' do
    assessment = create(:assessment)
    create(:assessment_skill, assessment: assessment, skill_label: 'Ruby')

    duplicate = build(:assessment_skill, assessment: assessment, skill_label: 'Ruby')

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:skill_label]).to be_present
  end

  it 'allows the same label in different assessments' do
    first  = create(:assessment)
    second = create(:assessment)
    create(:assessment_skill, assessment: first, skill_label: 'Ruby')

    expect(build(:assessment_skill, assessment: second, skill_label: 'Ruby')).to be_valid
  end
end
