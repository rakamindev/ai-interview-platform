# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Tenant #{n}" }
    sequence(:scheme) { |n| "tenant-#{n}" }
    sequence(:identifier) { |n| "tenant-#{n}" }
    host { "localhost" }
    alias_hosts { [] }
    config { {} }
  end

  factory :user do
    sequence(:email) { |n| "assessor#{n}@example.test" }
    password { "test-password-123" }
    role { "assessor" }
  end

  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { create(:user).id }
    sequence(:name) { |n| "Backend Engineer #{n}" }
    time_limit_min { 30 }
    language { "en" }
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { "Budi Santoso" }
    status { "pending" }
  end

  factory :portfolio do
    session
    candidate_id { nil }
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    skill_label { "React" }
    is_discovered { true }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["I built a design system at my last company."] }
    competency_summary { "Solid component-level React knowledge." }
  end
end
