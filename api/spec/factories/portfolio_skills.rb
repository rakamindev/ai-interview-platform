# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Portfolio Skill #{n}" }
    is_discovered { false }
    status { "rated" }
    ai_level { 3 }
    ai_confidence { "medium" }
    evidence { ["Sample quote."] }
    competency_summary { "Sample competency summary." }

    trait :not_assessed do
      status { "not_assessed" }
      ai_level { nil }
      ai_confidence { nil }
      competency_summary { nil }
    end
  end
end
