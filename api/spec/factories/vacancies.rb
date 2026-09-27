# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { 'Lead Frontend Engineer' }
    culture_dimensions { 'Fast-paced, ownership' }
    competency_expectations { 'Deep React and TypeScript' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    expected_level { 3 }
  end
end
