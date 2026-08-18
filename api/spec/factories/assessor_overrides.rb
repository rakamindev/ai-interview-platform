# frozen_string_literal: true

FactoryBot.define do
  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    overridden_by { 1 }
    overridden_at { Time.current }
  end
end
