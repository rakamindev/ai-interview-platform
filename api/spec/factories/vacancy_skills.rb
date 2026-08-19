FactoryBot.define do
  factory :vacancy_skill do
    vacancy
    skill_label { "Ruby on Rails" }
    skill_id { nil }
    expected_level { 3 }
  end
end
