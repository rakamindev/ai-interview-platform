# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Test Org #{n}" }
    sequence(:scheme) { |n| "test-org-#{n}" }
    sequence(:identifier) { |n| "test-org-#{n}" }
    host { "localhost" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Senior Frontend Engineer Assessment #{n}" }
    time_limit_min { 45 }
    language { "en" }
    system_prompt { "You are an expert skills assessor..." }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "React Engineering #{n}" }
    is_custom { false }
    scope_include { "Component architecture, hooks, state management" }
    scope_exclude { "Backend database internals" }
    l1_anchor { "Executes with guidance" }
    l2_anchor { "Executes independently on routine tasks" }
    l3_anchor { "Designs complex features with trade-offs" }
    l4_anchor { "Defines team standards and architecture" }
    l5_anchor { "Org-level thought leader" }
    expected_level { 3 }
    sequence(:display_order) { |n| n }
  end

  factory :session do
    tenant_id { 1 }
    assessment
    candidate_id { 2 }
    candidate_name { "Ahmad Rizky" }
    sequence(:invite_token) { |n| "tok-#{SecureRandom.hex(16)}-#{n}" }
    status { "pending" }
  end

  factory :coverage_map do
    session
    sequence(:skill_id) { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    state { "not_yet" }
    probe_count { 0 }
    last_signal { nil }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { "ai" }
    text { "Can you tell me about your experience with state management?" }
  end

  factory :portfolio do
    session
    candidate_id { session.candidate_id }
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "React Development #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Quote 1", "Quote 2"] }
    competency_summary { "Demonstrates strong understanding of state management and architectural trade-offs." }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { "Demonstrated L4 leadership in cross-team code review examples." }
    overridden_by { 1 }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { "Senior Frontend Engineer" }
    culture_dimensions { "ownership, directness, async-first" }
    competency_expectations { "Strong architecture, test-driven mindset" }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "React Development #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons do
      [
        {
          "skill_id" => "SK-ENG-001",
          "skill_label" => "React Development",
          "candidate_level" => 3,
          "expected_level" => 3,
          "result" => "match",
          "delta" => 0,
          "confidence" => "high"
        }
      ]
    end
    culture_narrative { "Aligns well with the team's engineering practices." }
    overall_narrative { "Strong candidate recommendation for Senior role." }
  end

  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Taxonomy Skill #{n}" }
    category { "engineering" }
    scope_include { "Core engineering principles" }
    l1_anchor { "L1 Anchor" }
    l2_anchor { "L2 Anchor" }
    l3_anchor { "L3 Anchor" }
    l4_anchor { "L4 Anchor" }
    l5_anchor { "L5 Anchor" }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@rakamin.com" }
    password { "password123" }
    role { "admin" }
  end
end
