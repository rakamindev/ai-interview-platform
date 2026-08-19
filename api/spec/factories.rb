# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Tenant #{n}" }
    sequence(:scheme) { |n| "tenant#{n}" }
    sequence(:identifier) { |n| "t#{n}" }
    sequence(:host) { |n| "t#{n}.example.com" }
    config { {} }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password_digest { 'secret' }
  end

  factory :assessment do
    name { 'Software Engineer Assessment' }
    time_limit_min { 30 }
    tenant_id { create(:organization).id }
    created_by { create(:user).id }
    language { 'en' }
  end

  factory :session do
    tenant_id { create(:organization).id }
    assessment { association :assessment, tenant_id: tenant_id }
    sequence(:invite_token) { |n| "token#{n}" }
    status { 'active' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    competency_summary { 'Demonstrates good proficiency.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    overridden_by { create(:user).id }
  end

  factory :vacancy do
    tenant_id { create(:organization).id }
    created_by { create(:user).id }
    role_title { 'Software Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [] }
  end
end
