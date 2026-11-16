# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 101 }
    created_by { 1 }
    role_title { 'Backend Engineer' }
  end

  factory :vacancy_skill do
    association :vacancy
    skill_id { 'backend-ruby' }
    skill_label { 'Ruby' }
    expected_level { 3 }
  end

  factory :portfolio do
    association :session
    candidate_id { 9001 }
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    association :portfolio
    skill_id { 'backend-ruby' }
    skill_label { 'Ruby' }
    is_discovered { true }
    ai_level { 2 }
    ai_confidence { 'high' }
    evidence { ['Implemented a Ruby service'] }
    competency_summary { 'Builds backend services in Ruby.' }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by { 42 }
    assessor_notes { 'Verified during manual review.' }
  end
end
