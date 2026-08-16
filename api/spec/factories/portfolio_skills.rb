# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['candidate said something revealing'] }
    competency_summary { 'Consistently demonstrates the skill.' }
  end
end
