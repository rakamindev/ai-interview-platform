# frozen_string_literal: true

# All names and text are invented. Tenant-scoped records take tenant_id from their organization
# explicitly, so factories work with or without a Current tenant.
FactoryBot.define do
  factory :assessment do
    transient { organization { association(:organization) } }

    tenant_id { organization.id }
    created_by { 1 }
    name { 'Frontend Engineer Intern (fake)' }
    time_limit_min { 30 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "SK-TEST-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    l1_anchor { 'Needs guidance.' }
    l2_anchor { 'Independent on routine scope.' }
    l3_anchor { 'Handles ambiguity and trade-offs.' }
    l4_anchor { 'Sets standards for others.' }
    l5_anchor { 'Shapes the practice org-wide.' }
    sequence(:display_order) { |n| n }
  end

  factory :session do
    transient { organization { association(:organization) } }

    assessment { association(:assessment, organization: organization) }
    tenant_id { assessment.tenant_id }
    candidate_id { 4242 }
    candidate_name { 'Dewi Lestari (fake)' }
    status { 'ended' }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'I keep server data in a query cache and local UI state in the component.' }
  end

  factory :coverage_map do
    session
    sequence(:skill_id) { |n| "SK-TEST-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    is_discovered { false }
    state { 'covered' }
    probe_count { 3 }
  end

  factory :portfolio do
    transient { organization { association(:organization) } }

    session { association(:session, organization: organization) }
    candidate_id { session.candidate_id }
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "SK-TEST-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['A quote the candidate said.'] }
    competency_summary { 'Consistent L3 behaviour across three probes.' }
  end

  factory :vacancy do
    transient { organization { association(:organization) } }

    tenant_id { organization.id }
    created_by { 1 }
    role_title { 'Frontend Engineer Intern (fake)' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "SK-TEST-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    expected_level { 2 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ 'skill_label' => 'Test Skill', 'expected_level' => 2, 'candidate_level' => 3, 'result' => 'exceed', 'delta' => 1 }] }
    overall_narrative { 'Fake narrative.' }
    generated_at { Time.current }
  end
end
