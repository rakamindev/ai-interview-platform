# frozen_string_literal: true

# tenant_id is assigned by TenantScoped from Current.tenant_id, so specs must
# establish a tenant (see TenantContext) before building tenanted records.
FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "assessor#{n}@spec-corp.example" }
    password { 'correct horse battery staple' }
    role { 'admin' }
  end

  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { 'en' }
    created_by { 1 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'L1 behaviour' }
    l2_anchor { 'L2 behaviour' }
    l3_anchor { 'L3 behaviour' }
    l4_anchor { 'L4 behaviour' }
    l5_anchor { 'L5 behaviour' }
    display_order { 0 }
  end

  factory :session do
    assessment
    status { 'ended' }
    candidate_id { 2 }
    candidate_name { 'Spec Candidate' }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'A synthetic answer.' }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state { 'covered' }
    probe_count { 3 }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['A quote.'] }
    competency_summary { 'A summary.' }

    trait :unassessed do
      ai_level { nil }
      ai_confidence { 'low' }
      evidence { [] }
      competency_summary { 'No evidence was produced for this skill.' }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 2 }
    assessor_notes { 'Downgraded pending a work sample.' }
    overridden_by { 1 }
    overridden_at { Time.current }
  end

  factory :vacancy do
    sequence(:role_title) { |n| "Role #{n}" }
    created_by { 1 }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end

  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "SK-SPEC-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Taxonomy Skill #{n}" }
    category { 'engineering' }
    l1_anchor { 'L1' }
    l2_anchor { 'L2' }
    l3_anchor { 'L3' }
    l4_anchor { 'L4' }
    l5_anchor { 'L5' }
  end
end
