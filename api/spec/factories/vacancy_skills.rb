# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    skill_id { 'SK-TEST-001' }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    expected_level { 3 }
  end
end
