FactoryBot.define do
  factory :portfolio do
    session
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    skill_id { "SK-ENG-001" }
    skill_label { "React / Frontend Development Core" }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { [] }
    competency_summary { "Builds routine features independently." }
  end
end
