# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { 'Frontend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
