# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { "high" }
    is_discovered { false }
    competency_summary { "Demonstrated deep knowledge of architecture and patterns." }
    evidence { ["Discussed state machines and memoization.", "Explained multi-region replication."] }
  end
end
