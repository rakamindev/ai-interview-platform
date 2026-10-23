# frozen_string_literal: true

# Every value here is synthetic. No real candidate data belongs in tests.
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Example Org #{n}" }
    sequence(:scheme)     { |n| "example-org-#{n}" }
    sequence(:identifier) { |n| "example-org-#{n}" }
    sequence(:host)       { |n| "example-org-#{n}.example.test" }
  end

  factory :assessment do
    tenant_id      { association(:organization).id }
    created_by     { 1 }
    name           { 'Backend Engineer Assessment' }
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
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['I split the service once the queue became the bottleneck.'] }
    competency_summary { 'Works independently on routine scope.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 3 }
    overridden_by  { 1 }
  end

  factory :vacancy do
    tenant_id  { association(:organization).id }
    created_by { 1 }
    role_title { 'Backend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons  { [] }
    comparator_version { FitGap::Comparator::VERSION }
  end
end
