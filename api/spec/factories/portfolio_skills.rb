# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:skill_id)    { |n| "SK-TEST-#{n}" }
    is_discovered          { false }
    ai_level               { 3 }
    not_assessed           { false }
    ai_confidence          { 'high' }
    evidence               { ['Sample quote from interview'] }
    competency_summary     { 'Shows strong understanding.' }

    transient do
      override_level { nil }
    end

    trait :not_assessed do
      ai_level      { nil }
      not_assessed  { true }
      ai_confidence { nil }
      evidence      { [] }
      competency_summary { 'Not assessed — insufficient probing.' }
    end

    trait :with_override do
      transient do
        override_level { 4 }
      end
    end

    after(:create) do |skill, evaluator|
      if evaluator.override_level.present?
        create(:assessor_override,
               portfolio_skill: skill,
               ai_level: skill.ai_level || 2,
               override_level: evaluator.override_level)
      end
    end
  end
end
