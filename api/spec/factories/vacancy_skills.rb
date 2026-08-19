# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    skill_id { 'sk-1' }
    skill_label { 'React' }
    expected_level { 3 }
  end
end
