# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    association :portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { 'Stronger than AI assessment suggests.' }
    overridden_by { 1000 }
    overridden_at { Time.current }
  end
end
