# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_label) { |n| "Required Skill #{n}" }
    sequence(:skill_id)    { |n| "SK-REQ-#{n}" }
    expected_level         { 3 }
  end
end
