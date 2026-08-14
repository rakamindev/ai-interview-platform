# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Evidence quote."] }
    competency_summary { "Demonstrated solid competency." }
  end
end
