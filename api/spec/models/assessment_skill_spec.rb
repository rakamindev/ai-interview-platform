# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill, type: :model do
  it 'loads through the Rails test harness' do
    expect(described_class.table_name).to eq('assessment_skills')
  end

  it 'rejects a taxonomy skill already used by the same assessment' do
    assessment = Assessment.create!(
      name: 'Test assessment',
      time_limit_min: 45,
      tenant_id: 1,
      created_by: 1
    )
    existing = assessment.assessment_skills.create!(
      skill_id: 'sk-eng-001',
      skill_label: 'React',
      is_custom: false,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5',
      display_order: 0
    )
    duplicate = assessment.assessment_skills.build(
      skill_id: 'sk-eng-001',
      skill_label: 'React',
      is_custom: false,
      l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5',
      display_order: 1
    )

    existing.valid?
    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:skill_id]).to include('has already been taken')
  end

  it 'rejects a taxonomy skill already used by the same vacancy' do
    vacancy = Vacancy.create!(
      role_title: 'Test vacancy',
      tenant_id: 1,
      created_by: 1
    )
    existing = vacancy.vacancy_skills.create!(
      skill_id: 'sk-vacancy-001', skill_label: 'React', expected_level: 3
    )
    duplicate = vacancy.vacancy_skills.build(
      skill_id: existing.skill_id, skill_label: 'React', expected_level: 3
    )

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:skill_id]).to include('has already been taken')
  end
end
