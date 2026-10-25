FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered          { false }
    ai_level                { 3 }
    ai_confidence           { "high" }
    evidence                { ["quote one", "quote two"] }
    competency_summary      { "Consistent, solid performance." }
  end
end
