# frozen_string_literal: true

# Fake data only: no real names, emails or interview content.
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Test Org #{n}" }
    sequence(:scheme)     { |n| "test-org-#{n}" }
    sequence(:identifier) { |n| "test-org-#{n}" }
    sequence(:host)       { |n| "test-org-#{n}.example.com" }
  end

  factory :assessment do
    tenant_id      { association(:organization).id }
    created_by     { 1 }
    name           { 'Frontend Engineer' }
    time_limit_min { 10 }
    language       { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label)   { |n| "Skill #{n}" }
    sequence(:display_order) { |n| n }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Works independently on routine scope' }
    l3_anchor { 'Handles ambiguity and trade-offs' }
    l4_anchor { 'Sets standards' }
    l5_anchor { 'Shapes the practice' }
  end

  factory :session do
    assessment
    tenant_id      { assessment.tenant_id }
    candidate_name { 'Test Candidate' }

    trait :ended do
      status           { 'ended' }
      end_reason       { 'time_ceiling' }
      started_at       { 10.minutes.ago }
      ended_at         { Time.current }
      duration_seconds { 600 }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'I handle loading and error states explicitly in every component.' }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state       { 'not_yet' }
    probe_count { 0 }
  end

  factory :portfolio do
    session { association(:session, :ended) }
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['I profile renders before optimizing.'] }
    competency_summary { 'Consistently reasons about trade-offs.' }

    trait :not_assessed do
      ai_level           { nil }
      ai_confidence      { nil }
      evidence           { [] }
      competency_summary { nil }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 4 }
    overridden_by  { 1 }
  end

  factory :vacancy do
    tenant_id  { association(:organization).id }
    created_by { 1 }
    role_title { 'Frontend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
