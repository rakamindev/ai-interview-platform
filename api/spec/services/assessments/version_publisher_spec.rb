# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::VersionPublisher do
  let(:assessment) { create(:assessment) }

  before do
    create(:assessment_skill, assessment:, display_order: 0, skill_label: 'React', skill_id: 'react')
  end

  it 'publishes one immutable version and reuses it for the same rubric revision' do
    publisher = described_class.new(assessment)

    version = publisher.call

    expect(version.rubric_version).to eq(1)
    expect(version.system_prompt).to include('SKILL: React')
    expect(version.assessment_version_skills.pluck(:skill_label)).to eq(['React'])
    expect(publisher.call.id).to eq(version.id)
    expect(assessment.assessment_versions.count).to eq(1)
  end

  it 'keeps a published version unchanged when the template moves to a new revision' do
    first_version = described_class.new(assessment).call
    original_skill = first_version.assessment_version_skills.first

    assessment.with_lock do
      assessment.update!(name: 'Staff Frontend Engineer')
      assessment.assessment_skills.first.update!(l3_anchor: 'Leads complex technical decisions')
      assessment.increment!(:rubric_version)
    end

    second_version = described_class.new(assessment).call

    expect(second_version.rubric_version).to eq(2)
    expect(second_version.name).to eq('Staff Frontend Engineer')
    expect(second_version.assessment_version_skills.first.l3_anchor).to eq('Leads complex technical decisions')
    expect(first_version.reload.name).to eq('Senior Frontend Engineer')
    expect(original_skill.reload.l3_anchor).to eq('Handles complex work')
  end

  it 'rejects application-level mutation of a published version and its skills' do
    version = described_class.new(assessment).call
    version_skill = version.assessment_version_skills.first

    expect(version.update(name: 'Changed')).to be(false)
    expect(version.errors.full_messages).to include('Published assessment versions are immutable')
    expect(version_skill.update(skill_label: 'Changed')).to be(false)
    expect(version_skill.errors.full_messages).to include('Published assessment version skills are immutable')

    extra_skill = version.assessment_version_skills.build(
      skill_label: 'Extra skill',
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5',
      expected_level: 3,
      display_order: 1
    )
    expect(extra_skill.save).to be(false)
    expect(extra_skill.errors.full_messages).to include('Assessment version skills can only be created while publishing a version')
  end

  it 'rejects an assessment with no skills before publishing a version' do
    assessment.assessment_skills.destroy_all

    expect { described_class.new(assessment).call }
      .to raise_error(Assessments::VersionPublisher::InvalidRubric, /at least one skill/)
    expect(assessment.assessment_versions).to be_empty
  end

  it 'rejects duplicate configured skill labels' do
    create(:assessment_skill, assessment:, display_order: 1, skill_label: 'React', skill_id: 'react-duplicate')

    expect { described_class.new(assessment).call }
      .to raise_error(Assessments::VersionPublisher::InvalidRubric, /duplicate skills/i)
  end
end
