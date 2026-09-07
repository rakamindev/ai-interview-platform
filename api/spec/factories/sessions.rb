# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    candidate_name { 'Ahmad Rizky' }
    status         { 'pending' }

    trait :active do
      status     { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status           { 'ended' }
      started_at       { 40.minutes.ago }
      ended_at         { Time.current }
      duration_seconds { 2400 }
      end_reason       { 'all_covered' }
    end
  end

  factory :coverage_map do
    association :session
    sequence(:skill_label) { |n| "Skill #{n}" }
    skill_id      { nil }
    is_discovered { false }
    state         { 'not_yet' }
    probe_count   { 0 }

    trait :discovered do
      is_discovered { true }
      state         { 'initiated' }
      probe_count   { 1 }
    end
  end

  factory :transcript_turn do
    association :session
    sequence(:turn_number)
    speaker { 'candidate' }
    text    { 'A substantive answer about how I approached the problem.' }
  end

  factory :portfolio do
    association :session
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    skill_id           { nil }
    is_discovered      { false }
    ai_level           { 3 }
    ai_confidence      { 'medium' }
    evidence           { ['"A revealing quote from the candidate."'] }
    competency_summary { 'Consistently demonstrates the behaviour described by the L3 anchor.' }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level       { 4 }
    override_level { 3 }
    assessor_notes { 'Evidence is team-level, not org-level.' }
    overridden_by  { 1 }
  end

  factory :vacancy do
    role_title              { 'Senior Frontend Engineer' }
    culture_dimensions      { 'ownership, directness, async-first' }
    competency_expectations { 'Owns delivery end to end.' }
    created_by              { 1 }
  end

  factory :vacancy_skill do
    association :vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    skill_id       { nil }
    expected_level { 3 }
  end
end
