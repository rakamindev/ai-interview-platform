# frozen_string_literal: true

# Test data is fictional. No real candidate names or transcripts.
FactoryBot.define do
  factory :assessment do
    tenant_id { Current.tenant_id }
    created_by { 1 }
    name { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "sk-test-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'What the skill covers' }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Works independently on routine scope' }
    l3_anchor { 'Handles ambiguity and trade-offs' }
    l4_anchor { 'Sets standards for others' }
    l5_anchor { 'Shapes the practice across the org' }
    expected_level { 3 }
    sequence(:display_order) { |n| n }
  end

  factory :session do
    tenant_id { Current.tenant_id }
    assessment
    status { 'ended' }
    end_reason { 'all_covered' }
    candidate_name { 'Test Candidate' }
  end

  factory :coverage_map do
    session
    skill_id { nil }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    state { 'covered' }
    probe_count { 3 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'I split the state into a read provider and a write provider.' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    skill_id { nil }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    rating_status { 'rated' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { [{ 'quote' => 'I split the state', 'turn_number' => 2 }] }
    competency_summary { 'Consistently reasons about trade-offs.' }

    trait :not_assessed do
      rating_status { 'not_assessed' }
      ai_level { nil }
      ai_confidence { 'low' }
      evidence { [] }
    end
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { portfolio_skill.ai_level }
    override_level { 4 }
    assessor_notes { 'Follow-up call showed stronger system design.' }
    overridden_by { 1 }
  end

  factory :vacancy do
    tenant_id { Current.tenant_id }
    created_by { 1 }
    role_title { 'Senior Frontend Engineer' }
    culture_dimensions { 'Ownership, async-first' }
  end

  factory :vacancy_skill do
    vacancy
    skill_id { nil }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
