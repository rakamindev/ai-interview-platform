# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    skill_id { 'sk-1' }
    skill_label { 'React' }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Quote 1', 'Quote 2'] }
    competency_summary { 'Strong React developer with hooks expertise.' }

    trait :discovered do
      is_discovered { true }
      skill_id { nil }
      skill_label { 'Micro-frontend Architecture' }
      ai_level { 2 }
      ai_confidence { 'low' }
    end
  end
end
