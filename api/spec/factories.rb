# frozen_string_literal: true

# tenant_id is set explicitly: TenantScoped falls back to Current.tenant_id,
# which raises when RequestStore has no tenant.
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Test Corp #{n}" }
    sequence(:scheme)     { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    host                  { 'localhost' }
  end

  factory :assessment do
    tenant_id      { 1 }
    created_by     { 1 }
    name           { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language       { 'en' }

    transient do
      skills_count { 0 }
    end

    after(:create) do |assessment, evaluator|
      evaluator.skills_count.times do |i|
        create(:assessment_skill, assessment: assessment, display_order: i)
      end
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:skill_id)    { |n| "sk-test-#{n}" }
    scope_include  { 'Everything in scope for this skill.' }
    scope_exclude  { 'Everything out of scope for this skill.' }
    l1_anchor      { 'Executes with explicit guidance.' }
    l2_anchor      { 'Executes independently on routine scope.' }
    l3_anchor      { 'Executes complex, ambiguous scope.' }
    l4_anchor      { 'Defines standards and reusable systems.' }
    l5_anchor      { 'Org level authority.' }
    expected_level { 3 }
    display_order  { 0 }
  end

  factory :session do
    tenant_id { 1 }
    assessment
    candidate_id   { 1 }
    candidate_name { 'Ahmad Rizky' }
    status         { 'pending' }

    trait :active do
      status     { 'active' }
      started_at { 5.minutes.ago }
    end

    trait :ended do
      status           { 'ended' }
      started_at       { 40.minutes.ago }
      ended_at         { Time.current }
      end_reason       { 'all_covered' }
      duration_seconds { 2400 }
    end
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:skill_id)    { |n| "sk-test-#{n}" }
    is_discovered { false }
    state         { 'not_yet' }
    probe_count   { 0 }

    trait :partial do
      state       { 'partial' }
      probe_count { 2 }
    end

    # Outside the analyzer's context window, with enough probes to be swept.
    trait :stale_partial do
      state       { 'partial' }
      probe_count { 4 }
    end

    trait :covered do
      state       { 'covered' }
      probe_count { 4 }
    end

    trait :discovered do
      is_discovered { true }
      skill_id      { nil }
      state         { 'initiated' }
      probe_count   { 1 }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'I split the context into a read only provider and a write provider.' }
  end

  factory :portfolio do
    session
    candidate_id      { 1 }
    generation_status { 'pending' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:skill_id)    { |n| "sk-test-#{n}" }
    is_discovered      { false }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['"A quote from the candidate."'] }
    competency_summary { 'Consistent L3 behaviour across the exchanges probed.' }
  end
end
