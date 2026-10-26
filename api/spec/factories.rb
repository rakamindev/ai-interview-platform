# frozen_string_literal: true

# Synthetic data only — no real candidate data (UU PDP).
FactoryBot.define do
  factory :organization do
    sequence(:name)   { |n| "Org #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    identifier { scheme }
    host       { "#{scheme}.test" }
  end

  factory :assessment do
    tenant_id      { association(:organization).id }
    created_by     { 1 }
    name           { 'Backend Engineer Interview' }
    time_limit_min { 30 }
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status    { 'ended' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    skill_label        { 'Communication' }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    competency_summary { 'Explains trade-offs clearly.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by  { 1 }
  end

  factory :vacancy do
    tenant_id  { association(:organization).id }
    created_by { 1 }
    role_title { 'Backend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    skill_label    { 'Communication' }
    expected_level { 3 }
  end
end
