# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_id) { |n| "sk-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
