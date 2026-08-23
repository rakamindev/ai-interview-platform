# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill_generation_event do
    association :portfolio_skill
    tenant_id { portfolio_skill.tenant_id }
    event_type { "stale_marked" }
    reason { "AI no longer returns this skill label" }
  end
end
