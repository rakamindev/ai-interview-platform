# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    skill_id { nil }
    sequence(:skill_label) { |n| "Portfolio Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'medium' }
    evidence { ['Quote 1', 'Quote 2'] }
    competency_summary { 'Test competency summary.' }

    trait :discovered do
      is_discovered { true }
      skill_id { nil }
    end

    trait :high_confidence do
      ai_confidence { 'high' }
    end

    trait :low_confidence do
      ai_confidence { 'low' }
    end
  end
end
