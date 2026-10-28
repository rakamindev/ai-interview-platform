# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { "Senior Frontend Engineer" }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    skill_label { "React / Frontend Development Core" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [] }
    overall_narrative { "placeholder" }
  end
end
