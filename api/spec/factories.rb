# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Tenant #{n}" }
    sequence(:scheme) { |n| "tenant-#{n}" }
    sequence(:identifier) { |n| "org_#{n}" }
    host { "localhost" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { "Senior Fullstack Engineer" }
    time_limit_min { 45 }
    language { "en" }

    trait :with_skills do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment, skill_label: "React / Frontend", expected_level: 3)
        create(:assessment_skill, assessment: assessment, skill_label: "System Design", expected_level: 3)
      end
    end
  end

  factory :assessment_skill do
    assessment
    skill_label { "React / Frontend" }
    l1_anchor { "Understands basic components" }
    l2_anchor { "Builds components independently" }
    l3_anchor { "Handles state tradeoffs" }
    l4_anchor { "Architects reusable design systems" }
    l5_anchor { "Org-wide frontend authority" }
    expected_level { 3 }
    display_order { 0 }
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { "pending" }
    sequence(:candidate_name) { |n| "Candidate #{n}" }
  end

  factory :portfolio do
    session
    generation_status { "complete" }
  end

  factory :portfolio_skill do
    portfolio
    skill_label { "React / Frontend" }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Quote 1", "Quote 2"] }
    competency_summary { "Demonstrates solid L3 proficiency in React." }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { "Demonstrated L4 level during live discussion." }
    overridden_by { 1 }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { "Senior Fullstack Engineer" }
    culture_dimensions { "High ownership, direct feedback" }
  end

  factory :vacancy_skill do
    vacancy
    skill_label { "React / Frontend" }
    expected_level { 3 }
  end
end
