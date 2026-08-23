FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    skill_label { Faker::ProgrammingLanguage.name }
    ai_level { rand(1..5) }
    ai_confidence { %w[high medium low].sample }
    competency_summary { Faker::Lorem.paragraph }
    evidence { [Faker::Quote.famous_last_words] }
  end
end
