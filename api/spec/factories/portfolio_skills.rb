FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    skill_label { "Ruby on Rails" }
    skill_id { nil }
    ai_level { 3 }
    ai_confidence { "high" }
    competency_summary { "Demonstrated solid understanding through several probing questions." }
    evidence { [] }
  end
end
