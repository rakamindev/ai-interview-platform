# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    status { 'assessed' }
    ai_level { 3 }
    ai_confidence { 'medium' }
    competency_summary { 'Explains trade-offs clearly.' }
  end
end
