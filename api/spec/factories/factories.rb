# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Organization #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-id-#{n}" }
    sequence(:host) { |n| "org-#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end

  factory :user do
    sequence(:email) { |n| "user-#{n}@example.com" }
    password { "password123" }
    role { "admin" }
  end

  factory :assessment do
    sequence(:name) { |n| "Senior Frontend Engineer Assessment #{n}" }
    time_limit_min { 30 }
    language { "en" }
    system_prompt { "You are an expert interviewer." }
    tenant_id { 1 }
    created_by { 1 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "sk-eng-#{n}" }
    skill_label { "React / Frontend Architecture" }
    is_custom { false }
    expected_level { 3 }
    display_order { 0 }
    l1_anchor { "Executes with close guidance." }
    l2_anchor { "Executes standard components independently." }
    l3_anchor { "Builds complex architectures and handles edge cases." }
    l4_anchor { "Designs system-wide architecture and standards." }
    l5_anchor { "Industry authority on frontend systems." }
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { "Budi Santoso" }
    sequence(:invite_token) { |n| "token_#{SecureRandom.hex(16)}_#{n}" }
    status { "ended" }
    duration_seconds { 1800 }
    started_at { 35.minutes.ago }
    ended_at { 5.minutes.ago }
  end

  factory :portfolio do
    session
    candidate_id { session.candidate_id }
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "sk-eng-#{n}" }
    skill_label { "React / Frontend Architecture" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["I optimized our bundle size by 40% using dynamic imports and code splitting.", "We built a shared design system across 4 squads."] }
    competency_summary { "Demonstrates strong understanding of component composition, performance profiling, and state isolation." }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    assessor_notes { "Candidate demonstrated system-wide impact in transcript turns 12-14." }
    overridden_by { 1 }
    overridden_at { Time.current }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { "Senior Frontend Engineer" }
    culture_dimensions { "High ownership, asynchronous communication, mentorship." }
    competency_expectations { "Expected to lead technical RFCs and raise code standards." }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "sk-eng-#{n}" }
    skill_label { "React / Frontend Architecture" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons do
      [
        {
          skill_label: "React / Frontend Architecture",
          skill_id: "sk-eng-1",
          candidate_level: 3,
          expected_level: 3,
          result: "match",
          delta: 0,
          confidence: "high"
        }
      ]
    end
    culture_narrative { "Candidate aligns well with independent problem solving." }
    overall_narrative { "Strong candidate for the Senior Frontend Engineer role." }
    generated_at { Time.current }
  end
end
