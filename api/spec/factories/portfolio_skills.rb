FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "medium" }
    evidence { ["Candidate explained the tradeoff clearly."] }
    competency_summary { "Solid grasp of the fundamentals." }
  end
end
