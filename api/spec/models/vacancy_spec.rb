# frozen_string_literal: true

require "rails_helper"

RSpec.describe Vacancy do
  def build_vacancy(skills)
    vacancy = described_class.new(tenant_id: 1, role_title: "Senior Frontend Engineer")
    skills.each do |skill|
      vacancy.vacancy_skills.build(skill)
    end
    vacancy
  end

  it "requires at least one required skill" do
    vacancy = build_vacancy([])

    expect(vacancy).not_to be_valid
    expect(vacancy.errors[:vacancy_skills]).to include("must include at least one required skill")
  end

  it "rejects duplicate stable skill IDs" do
    vacancy = build_vacancy([
      { skill_id: "react", skill_label: "React", expected_level: 3 },
      { skill_id: "react", skill_label: "React Core", expected_level: 4 }
    ])

    expect(vacancy).not_to be_valid
    expect(vacancy.errors[:vacancy_skills]).to include("must contain unique skills")
  end

  it "rejects duplicate normalized labels when IDs are unavailable" do
    vacancy = build_vacancy([
      { skill_id: nil, skill_label: "Communication", expected_level: 3 },
      { skill_id: nil, skill_label: " communication ", expected_level: 4 }
    ])

    expect(vacancy).not_to be_valid
    expect(vacancy.errors[:vacancy_skills]).to include("must contain unique skills")
  end

  it "accepts unique required skills" do
    vacancy = build_vacancy([
      { skill_id: "react", skill_label: "React", expected_level: 3 },
      { skill_id: "typescript", skill_label: "TypeScript", expected_level: 3 }
    ])

    expect(vacancy).to be_valid
  end
end
