# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:role_title) { |n| "Senior Frontend Engineer #{n}" }
    culture_dimensions { "High ownership and initiative." }
    competency_expectations { "Strong React and Web performance experience." }
  end

  factory :vacancy_skill do
    association :vacancy
    skill_id { "SK-ENG-001" }
    skill_label { "React / Frontend Development" }
    expected_level { 4 }
  end
end
