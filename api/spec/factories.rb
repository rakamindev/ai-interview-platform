# frozen_string_literal: true

# Synthetic data only — never real candidate data.
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Org #{n}" }
    sequence(:scheme)     { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host)       { |n| "org-#{n}.example.test" }
  end

  factory :user do
    sequence(:email) { |n| "assessor#{n}@example.test" }
    password { 'correct-horse-battery' }
    role     { 'admin' }
  end

  factory :assessment do
    transient do
      organization { association :organization }
    end

    tenant_id      { organization.id }
    name           { 'Senior Frontend Engineer' }
    time_limit_min { 30 }
    created_by     { 1 }

    trait :with_skills do
      after(:create) do |assessment|
        create(:assessment_skill, assessment:, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3, display_order: 0)
        create(:assessment_skill, assessment:, skill_id: 'SK-SOFT-001', skill_label: 'Communication', expected_level: 3, display_order: 1)
        create(:assessment_skill, assessment:, skill_id: 'SK-ENG-003', skill_label: 'System Design', expected_level: 2, display_order: 2)
      end
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'Needs close guidance.' }
    l2_anchor { 'Independent on routine scope.' }
    l3_anchor { 'Handles ambiguity and trade-offs.' }
    l4_anchor { 'Sets standards for the team.' }
    l5_anchor { 'Shapes practice across the org.' }
    sequence(:display_order)
  end

  factory :session do
    assessment
    tenant_id      { assessment.tenant_id }
    candidate_name { Faker::Name.name }
    status         { 'pending' }

    trait :ended do
      status           { 'ended' }
      end_reason       { 'manual_candidate' }
      started_at       { 20.minutes.ago }
      ended_at         { Time.current }
      duration_seconds { 1200 }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'candidate' }
    text    { 'We profiled with React DevTools and moved hot data into useRef.' }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state       { 'not_yet' }
    probe_count { 0 }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['We profiled with React DevTools.'] }
    competency_summary { 'Consistent L3 behaviour.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by  { 1 }
  end

  factory :vacancy do
    transient do
      organization { association :organization }
    end

    tenant_id  { organization.id }
    role_title { 'Senior Frontend Engineer' }
    created_by { 1 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ skill_label: 'React', expected_level: 3, candidate_level: 3, result: 'match', delta: 0 }] }
    overall_narrative { 'Overall text.' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
