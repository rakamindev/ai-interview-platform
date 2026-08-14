# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    association :portfolio
    skill_label        { 'Test Skill' }
    ai_level           { 3 }
    ai_confidence      { 'medium' }
    competency_summary { 'Demonstrated solid competency.' }
  end
end
