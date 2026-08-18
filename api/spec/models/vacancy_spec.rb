# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  it 'creates a VacancyVersion capturing current field values on save' do
    vacancy = create(:vacancy, role_title: 'Backend Engineer', public_requirement_text: 'Must know Ruby.')

    expect(vacancy.vacancy_versions.count).to eq(1)

    version = vacancy.vacancy_versions.last
    expect(version.role_title).to eq('Backend Engineer')
    expect(version.culture_dimensions).to eq(vacancy.culture_dimensions)
    expect(version.competency_expectations).to eq(vacancy.competency_expectations)
    expect(version.public_requirement_text).to eq('Must know Ruby.')
    expect(version.skills_snapshot).to eq([])
    expect(version.approximate).to be(false) # only the Phase 2 backfill task sets this true
  end

  it 'captures a destroy-and-recreate of vacancy_skills via nested attributes in the next version' do
    vacancy = create(:vacancy)
    old_skill = create(:vacancy_skill, vacancy: vacancy, skill_id: 'old', skill_label: 'Old Skill', expected_level: 2)

    # vacancy.vacancy_skills was cached (as empty) by the after_save callback's own
    # `.reload` when `vacancy` was first created, before old_skill existed — reload
    # the parent itself so the nested-attributes lookup below sees it.
    vacancy.reload

    vacancy.update!(
      vacancy_skills_attributes: [
        { id: old_skill.id, _destroy: true },
        { skill_id: 'new', skill_label: 'New Skill', expected_level: 4 }
      ]
    )

    latest_snapshot = vacancy.vacancy_versions.last.skills_snapshot
    expect(latest_snapshot.size).to eq(1)
    expect(latest_snapshot.first['skill_id']).to eq('new')
    expect(latest_snapshot.first['skill_label']).to eq('New Skill')
    expect(latest_snapshot.first['expected_level']).to eq(4)
  end

  it 'never mutates earlier versions when a later save creates a new one' do
    vacancy = create(:vacancy, role_title: 'Backend Engineer')
    first_version = vacancy.vacancy_versions.last

    vacancy.update!(role_title: 'Senior Backend Engineer')
    vacancy.update!(role_title: 'Staff Backend Engineer')

    expect(vacancy.vacancy_versions.count).to eq(3)
    expect(first_version.reload.role_title).to eq('Backend Engineer')
  end
end
