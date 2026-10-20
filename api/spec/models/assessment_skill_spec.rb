# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:) }

  it 'keeps legacy nullable skill config editable when unrelated fields change' do
    skill = create(:assessment_skill, assessment:)
    skill.update_columns(
      skill_id: nil,
      scope_include: nil,
      scope_exclude: nil,
      l1_anchor: "",
      l2_anchor: "",
      l3_anchor: "",
      l4_anchor: "",
      l5_anchor: "",
      expected_level: nil
    )
    skill.reload

    skill.update!(skill_label: 'Renamed legacy skill')

    expect(skill.reload.skill_label).to eq('Renamed legacy skill')
  end

  it 'still rejects missing scope on a new configured skill' do
    skill = build(:assessment_skill, assessment:, scope_include: nil)

    expect(skill).not_to be_valid
    expect(skill.errors.full_messages).to include('Skill scope is required')
  end
end
