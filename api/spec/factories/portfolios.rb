# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label)  { |n| "Skill #{n}" }
    ai_level                { 3 }
    ai_confidence            { 'high' }
    competency_summary       { 'Solid grasp demonstrated across the interview.' }
  end
end
