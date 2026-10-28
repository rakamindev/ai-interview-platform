# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    candidate_id { session.candidate_id }
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_id) { |n| "SKILL_#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Demonstrated strong understanding of domain architecture.'] }
    competency_summary { 'Consistently applied solid engineering principles.' }
    is_discovered { false }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by { 1 }
    assessor_notes { 'Demonstrated higher proficiency during technical probe.' }
  end
end
