# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title)          { |n| "Role #{n}" }
    culture_dimensions             { "We value ownership and clear communication." }
    competency_expectations        { "Strong technical depth with cross-functional impact." }
    created_by                     { 1 }
    tenant_id                      { 1 }
  end

  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_id)    { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
