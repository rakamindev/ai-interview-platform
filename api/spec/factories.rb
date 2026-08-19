# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:scheme) { |n| "tenant-#{n}" }
    name { 'Test Corp' }
    identifier { scheme }
    host { "#{scheme}.example.com" }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'Password123!' }
    role { 'user' }

    factory :admin_user do
      role { 'admin' }
    end
  end

  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
    role_title { 'Engineer' }
  end

  factory :assessment_skill do
    association :assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { '' }
    scope_exclude { '' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
    expected_level { 3 }
    display_order { 1 }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { 'Backend Engineer' }
    culture_dimensions { 'async-first' }
    competency_expectations { '' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end

  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    category { 'engineering' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end

  factory :session do
    association :assessment
    tenant_id { 1 }
    invite_token { SecureRandom.hex(32) }
    status { 'pending' }
  end

  factory :portfolio do
    association :session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'medium' }
    competency_summary { 'Solid, evidence-backed.' }
  end
end
