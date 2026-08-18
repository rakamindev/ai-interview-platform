# frozen_string_literal: true

# Minimal factories for the AI Interview domain.
# Organizations have no model validations (read-only mirror of the public
# schema), so factories only need to satisfy DB NOT NULL constraints.

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Tenant Org #{n}" }
    sequence(:scheme) { |n| "tenant-org-#{n}" }
    sequence(:identifier) { |n| "tenant-org-#{n}" }
    sequence(:host) { |n| "tenant-org-#{n}.example.com" }
  end

  factory :assessment do
    tenant_id { create(:organization).id }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
  end

  factory :session do
    tenant_id { create(:organization).id }
    assessment
    sequence(:invite_token) { |n| SecureRandom.hex(32) }
    status { 'pending' }
  end

  factory :vacancy do
    tenant_id { create(:organization).id }
    created_by { 1 }
    sequence(:role_title) { |n| "Vacancy #{n}" }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { true }
    ai_level { 3 }
    ai_confidence { 'medium' }
    evidence { [] }
    competency_summary { 'Demonstrated solid understanding.' }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ 'skill_label' => 'Ruby', 'result' => 'match' }] }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Taxonomy Skill #{n}" }
    is_custom { false }
    expected_level { 3 }
    display_order { 0 }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end

  factory :custom_skill do
    tenant_id { create(:organization).id }
    created_by { 1 }
    sequence(:skill_label) { |n| "Custom Skill #{n}" }
    scope_include { 'What counts' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@test-corp.dev" }
    # Random password — no literal secrets in code.
    password { SecureRandom.alphanumeric(12) }
    role { 'assessor' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Req Skill #{n}" }
    expected_level { 3 }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    overridden_by { 1 }
  end
end
