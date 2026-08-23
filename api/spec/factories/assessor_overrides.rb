# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    association :portfolio_skill
    tenant_id { portfolio_skill.tenant_id }
    ai_level { 2 }
    override_level { 4 }
    assessor_notes { "Override reason." }
    overridden_by { 1 }
    overridden_at { Time.current }
  end
end
