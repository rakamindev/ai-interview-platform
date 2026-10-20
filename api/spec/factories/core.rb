# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Synthetic Organization #{n}" }
    sequence(:scheme) { |n| "synthetic-tenant-#{n}" }
    sequence(:identifier) { |n| "synthetic-identifier-#{n}" }
    sequence(:host) { |n| "tenant-#{n}.test" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    transient do
      organization { nil }
    end

    tenant_id { organization&.id || Current.tenant_id || 1 }
    created_by { 7_001 }
    sequence(:name) { |n| "Synthetic Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
    system_prompt { nil }
  end

  factory :session do
    transient do
      organization { nil }
    end

    association :assessment, organization: :organization
    tenant_id { organization&.id || assessment.tenant_id }
    candidate_id { 70_001 }
    candidate_name { nil }
    status { 'ended' }
  end

  factory :portfolio do
    transient do
      organization { nil }
    end

    association :session, organization: :organization
    candidate_id { session.candidate_id }
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    transient do
      organization { nil }
    end

    association :portfolio, organization: :organization
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Synthetic Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'medium' }
    evidence { ['Synthetic evidence quote.'] }
    competency_summary { 'Synthetic competency summary.' }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    assessor_notes { 'Synthetic assessor note.' }
    overridden_by { 7_001 }
  end

  factory :assessment_skill do
    transient do
      organization { nil }
    end

    association :assessment, organization: :organization
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Synthetic Assessment Skill #{n}" }
    is_custom { false }
    scope_include { 'Synthetic scope.' }
    l1_anchor { 'Synthetic L1 anchor.' }
    l2_anchor { 'Synthetic L2 anchor.' }
    l3_anchor { 'Synthetic L3 anchor.' }
    l4_anchor { 'Synthetic L4 anchor.' }
    l5_anchor { 'Synthetic L5 anchor.' }
    expected_level { 3 }
    display_order { 0 }
  end

  factory :vacancy do
    transient do
      organization { nil }
    end

    tenant_id { organization&.id || Current.tenant_id || 1 }
    created_by { 7_001 }
    sequence(:role_title) { |n| "Synthetic Role #{n}" }
    culture_dimensions { nil }
    competency_expectations { nil }
  end

  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Synthetic Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [] }
    culture_narrative { nil }
    overall_narrative { 'Synthetic overall narrative.' }
  end
end
