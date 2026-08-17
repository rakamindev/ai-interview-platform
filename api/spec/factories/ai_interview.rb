# frozen_string_literal: true

# Factory definitions for the AI interview domain.
#
# Tenant note: Assessment/Session/Vacancy/Portfolio/FitGapReport are
# tenant-scoped. Their tenant_id is auto-assigned from Current.tenant_id, so
# specs must create them inside `in_tenant { ... }` (see TenantHelpers).

FactoryBot.define do
  factory :organization do
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:name)   { |n| "Org #{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    host { 'localhost' }
    alias_hosts { [] }
    config { {} }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    role { 'admin' }
  end

  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { 'en' }
    created_by { 1 }
  end

  factory :assessment_skill do
    association :assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    l1_anchor { 'L1 behavior' }
    l2_anchor { 'L2 behavior' }
    l3_anchor { 'L3 behavior' }
    l4_anchor { 'L4 behavior' }
    l5_anchor { 'L5 behavior' }
    display_order { 0 }
  end

  factory :session do
    association :assessment
    candidate_name { 'Ahmad Rizky' }
    status { 'pending' }
  end

  factory :coverage_map do
    association :session
    sequence(:skill_label) { |n| "Coverage #{n}" }
    state { 'not_yet' }
    probe_count { 0 }
  end

  factory :portfolio do
    association :session
    generation_status { 'pending' }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Portfolio Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['quote'] }
    competency_summary { 'Summary text' }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { 'Assessor note' }
    overridden_by { 1 }
  end

  factory :vacancy do
    sequence(:role_title) { |n| "Vacancy #{n}" }
    created_by { 1 }
  end

  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_label) { |n| "Vacancy Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons do
      [{ 'skill_label' => 'React', 'expected_level' => 3, 'candidate_level' => 3, 'result' => 'match' }]
    end
  end
end