# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    tenant_id { portfolio.tenant_id }
    skill_id { "SK-TEST-001" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { [] }
    competency_summary { "A test competency summary." }
  end
end
