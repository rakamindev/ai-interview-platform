# frozen_string_literal: true

FactoryBot.define do
  sequence(:organization_scheme) { |n| "scheme-#{n}" }
  sequence(:organization_identifier) { |n| "identifier-#{n}" }
  sequence(:role_title) { |n| "Software Engineer #{n}" }
  sequence(:email) { |n| "user#{n}@example.com" }

  factory :organization do
    scheme     { generate(:organization_scheme) }
    identifier { generate(:organization_identifier) }
    name       { "Rakamin Test Org" }
    host       { "rakamin.test" }
    alias_hosts { [] }
    config     { {} }
  end

  factory :assessment do
    tenant_id     { TenantHelper::DEFAULT_TENANT_ID }
    created_by    { 1 }
    name          { "Fullstack Interview" }
    time_limit_min { 30 }
    language      { "id" }
  end

  factory :assessment_skill do
    association :assessment
    skill_id   { "sk-test-001" }
    skill_label { "Ruby on Rails" }
    is_custom  { false }
    l1_anchor  { "Can follow instructions" }
    l2_anchor  { "Works independently on routine tasks" }
    l3_anchor  { "Handles complex ambiguous scope" }
    l4_anchor  { "Defines standards and systems" }
    l5_anchor  { "Org-level authority" }
    expected_level { 3 }
    display_order  { 1 }
  end

  factory :session do
    tenant_id    { TenantHelper::DEFAULT_TENANT_ID }
    association  :assessment
    candidate_id { 1 }
    status       { "pending" }
  end

  factory :vacancy do
    tenant_id   { TenantHelper::DEFAULT_TENANT_ID }
    created_by  { 1 }
    role_title  { generate(:role_title) }
    culture_dimensions      { "Fast-paced, async-first" }
    competency_expectations { "Owns features end to end" }
  end

  factory :vacancy_skill do
    association   :vacancy
    skill_id      { "sk-test-001" }
    skill_label   { "Ruby on Rails" }
    expected_level { 3 }
  end

  factory :skill_taxonomy do
    skill_id    { "sk-test-001" }
    skill_label { "Ruby on Rails" }
    category    { "engineering" }
    l1_anchor   { "Can follow instructions" }
    l2_anchor   { "Works independently on routine tasks" }
    l3_anchor   { "Handles complex ambiguous scope" }
    l4_anchor   { "Defines standards and systems" }
    l5_anchor   { "Org-level authority" }
  end

  factory :portfolio do
    association       :session
    candidate_id      { 1 }
    generation_status { "pending" }
  end

  factory :portfolio_skill do
    association       :portfolio
    skill_id          { "sk-test-001" }
    skill_label       { "Ruby on Rails" }
    is_discovered     { false }
    ai_level          { 3 }
    ai_confidence     { "high" }
    evidence          { ["quote 1", "quote 2"] }
    competency_summary { "Consistently ships features end to end" }
  end

  factory :assessor_override do
    association     :portfolio_skill
    ai_level        { 3 }
    override_level  { 4 }
    overridden_by   { 1 }
  end

  factory :coverage_map do
    association :session
    skill_id    { "sk-test-001" }
    skill_label { "Ruby on Rails" }
    is_discovered { false }
    state       { "covered" }
    probe_count { 3 }
  end

  factory :transcript_turn do
    association :session
    turn_number { 1 }
    speaker     { "candidate" }
    text        { "I have shipped three Rails services." }
  end

  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ "skill_label" => "Ruby on Rails", "skill_id" => "sk-test-001", "candidate_level" => 3, "expected_level" => 3, "result" => "match", "delta" => 0, "confidence" => "high" }] }
    culture_narrative { "Strong cultural alignment observed." }
    overall_narrative { "Recommended for hire." }
    provenance_token { nil }
  end
end