# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  it 'creates an AssessmentVersion capturing current field values on save' do
    assessment = create(:assessment, name: 'Backend Interview', time_limit_min: 45, language: 'en')

    expect(assessment.assessment_versions.count).to eq(1)

    version = assessment.assessment_versions.last
    expect(version.name).to eq('Backend Interview')
    expect(version.time_limit_min).to eq(45)
    expect(version.language).to eq('en')
    expect(version.skills_snapshot).to eq([])
  end

  it 'captures a destroy-and-recreate of assessment_skills via nested attributes in the next version' do
    assessment = create(:assessment)
    old_skill = create(:assessment_skill, assessment: assessment, skill_id: 'old', skill_label: 'Old Skill',
                                           expected_level: 2)

    # assessment.assessment_skills was cached (as empty) by the after_save callback's
    # own `.reload` when `assessment` was first created, before old_skill existed —
    # reload the parent itself so the nested-attributes lookup below sees it.
    assessment.reload

    assessment.update!(
      assessment_skills_attributes: [
        { id: old_skill.id, _destroy: true },
        {
          skill_id: 'new', skill_label: 'New Skill', is_custom: false,
          scope_include: 'In', scope_exclude: 'Out',
          l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5',
          expected_level: 4, display_order: 0
        }
      ]
    )

    latest_snapshot = assessment.assessment_versions.last.skills_snapshot
    expect(latest_snapshot.size).to eq(1)
    expect(latest_snapshot.first['skill_id']).to eq('new')
    expect(latest_snapshot.first['expected_level']).to eq(4)
  end

  it 'never mutates earlier versions when a later save creates a new one' do
    assessment = create(:assessment, name: 'Backend Interview')
    first_version = assessment.assessment_versions.last

    assessment.update!(name: 'Senior Backend Interview')
    assessment.update!(name: 'Staff Backend Interview')

    expect(assessment.assessment_versions.count).to eq(3)
    expect(first_version.reload.name).to eq('Backend Interview')
  end
end
