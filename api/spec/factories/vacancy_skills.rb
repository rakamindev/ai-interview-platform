# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    skill_id { nil }
    sequence(:skill_label) { |n| "Vacancy Skill #{n}" }
    expected_level { 3 }
  end
end
