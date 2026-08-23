FactoryBot.define do
  factory :vacancy_skill do
    association :vacancy
    skill_label { Faker::ProgrammingLanguage.name }
    expected_level { rand(1..5) }
  end
end
