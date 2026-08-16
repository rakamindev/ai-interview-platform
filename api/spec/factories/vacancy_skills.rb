# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
