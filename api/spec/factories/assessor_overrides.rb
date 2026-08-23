# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by { 1 }
    overridden_at { Time.current }
    assessor_notes { "Demonstrated superior leadership skills during the architectural trade-off discussion." }
  end
end
