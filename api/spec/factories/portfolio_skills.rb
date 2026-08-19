# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "skill-#{n}" }
    skill_label { 'Ruby on Rails' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Demonstrated understanding of the request lifecycle.'] }
    competency_summary { 'Solid working knowledge, some gaps in edge cases.' }
  end
end
