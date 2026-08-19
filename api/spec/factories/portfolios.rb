# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { 'pending' }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Portfolio Skill #{n}" }
    ai_level          { 3 }
    ai_confidence     { 'high' }
    evidence          { ["Candidate demonstrated the skill."] }
    competency_summary { 'Demonstrated working knowledge.' }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level       { 3 }
    override_level { 4 }
    overridden_by  { 1 }
  end
end