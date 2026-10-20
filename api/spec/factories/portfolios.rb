# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    assessment_status { 'assessed' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['I measured p95 latency before and after the change.'] }
    competency_summary { 'Handles ambiguous scope with clear trade-offs.' }

    trait :not_assessed do
      assessment_status { 'not_assessed' }
      ai_level { nil }
      ai_confidence { nil }
      evidence { [] }
      competency_summary { nil }
    end

    trait :insufficient_evidence do
      assessment_status { 'insufficient_evidence' }
      ai_level { nil }
      ai_confidence { nil }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by { 1 }
  end
end
