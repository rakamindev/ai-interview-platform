# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id      { RequestStore.store[:tenant_id] || raise('create inside as_tenant') }
    created_by     { 1 }
    name           { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Independent on routine work' }
    l3_anchor { 'Handles ambiguity and trade-offs' }
    l4_anchor { 'Sets standards' }
    l5_anchor { 'Org-level authority' }
    expected_level { 3 }
    sequence(:display_order)
  end

  factory :session do
    assessment
    tenant_id      { assessment.tenant_id }
    status         { 'ended' }
    end_reason     { 'time_ceiling' }
    candidate_name { 'Sample Candidate' }
    started_at     { 45.minutes.ago }
    ended_at       { Time.current }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state       { 'covered' }
    probe_count { 3 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'candidate' }
    text    { 'I profiled the dashboard and moved hot data into a ref.' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    assessment_status  { 'assessed' }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    competency_summary { 'Consistently reasons about trade-offs.' }

    trait :not_assessed do
      assessment_status { 'not_assessed' }
      status_reason     { 'never_reached' }
      ai_level          { nil }
      ai_confidence     { nil }
    end
  end

  factory :vacancy do
    tenant_id  { RequestStore.store[:tenant_id] || raise('create inside as_tenant') }
    created_by { 1 }
    role_title { 'Senior Frontend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
