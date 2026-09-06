# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    association :portfolio_skill
    ai_level       { portfolio_skill.ai_level || 2 }
    override_level { 4 }
    overridden_by  { 1 }
    assessor_notes { 'Demonstrated deeper knowledge during probing.' }
  end
end
