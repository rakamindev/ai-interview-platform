FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { "high" }
    competency_summary { "Demonstrates solid understanding." }
    evidence { ["Quote demonstrating the skill."] }
  end
end
