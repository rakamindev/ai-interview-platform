# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Org #{n}" }
    sequence(:scheme)     { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org#{n}" }
    sequence(:host)       { |n| "org#{n}.localhost" }
    alias_hosts { [] }
    config { {} }

    trait :test_corp do
      name       { 'Test Corp' }
      scheme     { 'test-corp' }
      identifier { 'test-corp' }
      host       { 'localhost' }
    end
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    role { 'admin' }
  end

  factory :assessment do
    tenant_id      { Current.tenant_id }
    created_by     { 1 }
    name           { 'Backend Engineer Assessment' }
    time_limit_min { 30 }
    language       { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom      { false }
    l1_anchor      { 'L1: executes with guidance' }
    l2_anchor      { 'L2: executes routine scope' }
    l3_anchor      { 'L3: complex scope' }
    l4_anchor      { 'L4: defines standards' }
    l5_anchor      { 'L5: org authority' }
    expected_level { 3 }
    display_order  { 0 }
  end

  factory :session do
    assessment
    tenant_id      { Current.tenant_id }
    candidate_name { 'Candidate One' }
    status         { 'pending' }
  end

  factory :coverage_map do
    session
    skill_id    { 'SK-ENG-001' }
    skill_label { 'React / Frontend Development' }
    is_discovered { false }
    state       { 'not_yet' }
    probe_count { 0 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'I built a billing system end to end with Rails.' }
  end

  factory :vacancy do
    tenant_id              { Current.tenant_id }
    created_by             { 1 }
    role_title             { 'Senior Backend Engineer' }
    culture_dimensions     { 'Autonomy and ownership.' }
    competency_expectations { 'REST APIs and SQL.' }
  end

  factory :vacancy_skill do
    vacancy
    skill_id       { 'SK-ENG-002' }
    skill_label    { 'Node.js / Backend Development' }
    expected_level { 3 }
  end

  factory :portfolio do
    session
    candidate_id      { 2 }
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    skill_id      { 'SK-ENG-001' }
    skill_label   { 'React / Frontend Development' }
    is_discovered { false }
    ai_level      { 3 }
    ai_confidence { 'medium' }
    evidence      { ['They refactored the state layer with clear trade-offs.', 'They handled the edge case of concurrent edits.'] }
    competency_summary { 'Builds complex features end to end and owns their test strategy.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level      { 3 }
    override_level { 4 }
    assessor_notes { 'Strong architecture discussion, promoted.' }
    overridden_by { 1 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [] }
    culture_narrative { 'Aligned with an autonomous environment.' }
    overall_narrative { 'Candidate is a solid match for the role.' }
    generated_at      { Time.current }
  end
end