# frozen_string_literal: true

FactoryBot.define do
  sequence(:organization_sequence) { |n| n }

  factory :organization do
    transient do
      sequence_number { generate(:organization_sequence) }
    end

    name { "Assessment Org #{sequence_number}" }
    scheme { "assessment-org-#{sequence_number}" }
    identifier { "assessment-org-#{sequence_number}" }
    host { "assessment-org-#{sequence_number}.test" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    tenant_id { create(:organization).id }
    created_by { 1 }
    name { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'Relevant practical behavior' }
    scope_exclude { 'Unrelated behavior' }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Handles routine work' }
    l3_anchor { 'Handles complex work' }
    l4_anchor { 'Defines standards' }
    l5_anchor { 'Shapes organization practice' }
    expected_level { 3 }
    sequence(:display_order)
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { 'ended' }
    end_reason { 'all_covered' }
    started_at { 45.minutes.ago }
    ended_at { Time.current }
    duration_seconds { 2700 }
  end

  factory :portfolio do
    session
    candidate_id { session.candidate_id }
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "portfolio-skill-#{n}" }
    sequence(:skill_label) { |n| "Portfolio Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Candidate explained a concrete implementation trade-off.'] }
    competency_summary { 'Consistently demonstrates the configured skill at the expected level.' }
  end

  factory :portfolio_decision do
    portfolio
    ai_outcome { 'pass' }
    ai_rationale { 'Configured skills broadly meet their expected levels with sufficient evidence.' }
    ai_recommended_at { Time.current }
  end
end
