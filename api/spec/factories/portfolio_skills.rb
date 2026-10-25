# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    skill_id { "skill-#{SecureRandom.hex(4)}" }
    skill_label { "Ruby" }
    ai_level { 3 }
    ai_confidence { "medium" }
    competency_summary { "Solid demonstrated skill" }
    evidence { [] }
  end
end
