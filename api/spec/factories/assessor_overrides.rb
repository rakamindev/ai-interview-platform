# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    association :portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { "Adjusted based on live observation." }
    overridden_by { 1 }
  end
end
