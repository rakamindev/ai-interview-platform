# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  def build_session_with_skill(assessment, skill_label:)
    # Via nested attributes, not a direct factory create — a version snapshot is
    # only captured when the assessment itself is saved (Assessment#after_save),
    # which is exactly how a recruiter actually adds skills through the real API.
    assessment.update!(
      assessment_skills_attributes: [
        {
          skill_id: 'skill-a', skill_label: skill_label, is_custom: false,
          l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e',
          expected_level: 3, display_order: 0
        }
      ]
    )
    Sessions::Creator.new(assessment: assessment, tenant_id: assessment.tenant_id).call
  end

  it "pins a candidate's coverage maps to the assessment skills at invite time, " \
     'even after the assessment is edited afterward (P0 regression)' do
    assessment = create(:assessment)
    session = build_session_with_skill(assessment, skill_label: 'Original Skill')

    # Recruiter edits the assessment AFTER the candidate was already invited.
    old_skill = assessment.assessment_skills.find_by(skill_id: 'skill-a')
    assessment.update!(
      assessment_skills_attributes: [
        { id: old_skill.id, _destroy: true },
        {
          skill_id: 'skill-b', skill_label: 'Edited Skill', is_custom: false,
          l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e',
          expected_level: 3, display_order: 0
        }
      ]
    )

    described_class.new(session).call

    expect(session.coverage_maps.pluck(:skill_label)).to eq(['Original Skill'])
  end

  it 'falls back to the assessment live skills for a legacy session with no assessment_version ' \
     '(nullable, pre-Phase-2-backfill)' do
    assessment = create(:assessment)
    create(:assessment_skill, assessment: assessment, skill_label: 'Live Skill')
    assessment.reload

    session = create(:session, assessment: assessment)
    session.update_column(:assessment_version_id, nil)

    described_class.new(session).call

    expect(session.coverage_maps.pluck(:skill_label)).to eq(['Live Skill'])
  end
end
