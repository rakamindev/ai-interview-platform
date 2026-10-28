# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    skill_label { "React / Frontend Development Core" }
    is_discovered { false }
    assessment_status { "assessed" }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Walked through a concrete example with measurable impact."] }
    competency_summary { "Demonstrates solid end-to-end ownership." }

    trait :insufficient_evidence do
      assessment_status { "insufficient_evidence" }
      ai_level { 1 }
      ai_confidence { "low" }
      evidence { [] }
    end

    trait :not_assessed do
      assessment_status { "not_assessed" }
      ai_level { nil }
      ai_confidence { "low" }
      evidence { [] }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 2 }
    assessor_notes { "Examples were team-led, not individually owned." }
    overridden_by { 1 }
  end
end
