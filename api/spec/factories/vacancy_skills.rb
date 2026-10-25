# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    skill_id { "skill-#{SecureRandom.hex(4)}" }
    skill_label { "Ruby" }
    expected_level { 3 }
  end
end
