# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    status { "assessed" }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Evidence quote."] }
    competency_summary { "Demonstrated solid competency." }

    trait :not_assessed do
      status { "not_assessed" }
      ai_level { nil }
      ai_confidence { nil }
      evidence { [] }
      competency_summary { "This skill was configured for the assessment but was not covered during the interview." }
    end

    trait :unparseable do
      status { "unparseable" }
      ai_level { nil }
      ai_confidence { nil }
      competency_summary { "Needs manual review." }
    end
  end
end
