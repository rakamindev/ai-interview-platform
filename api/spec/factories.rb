# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id      { TEST_TENANT_ID }
    created_by     { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language       { 'en' }
  end


  factory :session do
    tenant_id  { TEST_TENANT_ID }
    assessment
    status     { 'pending' }

    trait :active do
      status     { 'active' }
      started_at { 5.minutes.ago }
    end

    trait :ended do
      status           { 'ended' }
      started_at       { 20.minutes.ago }
      ended_at         { Time.current }
      end_reason       { 'manual_candidate' }
      duration_seconds { 1200 }
    end
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state         { 'not_yet' }
    probe_count   { 0 }
    is_discovered { false }

    trait :untouched do
      state { 'not_yet' }
      probe_count { 0 }
    end

    trait :initiated do
      state { 'initiated' }
      probe_count { 1 }
    end

    trait :partial do
      state { 'partial' }
      probe_count { 2 }
    end

    trait :covered do
      state { 'covered' }
      probe_count { 3 }
    end

    trait :discovered do
      is_discovered { true }
      state { 'initiated' }
      probe_count { 1 }
    end
  end


  factory :portfolio do
    session
    generation_status { 'pending' }

    trait :complete do
      generation_status { 'complete' }
      generated_at      { Time.current }
    end

    trait :failed do
      generation_status { 'failed' }
      generation_error  { 'API returned 503' }
    end
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered      { false }
    ai_level           { 2 }
    ai_confidence      { 'medium' }
    evidence           { ['a revealing quote', 'another revealing quote'] }
    competency_summary { 'The candidate does routine work independently.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { 2 }
    override_level { 3 }
    overridden_by  { 1 }
    overridden_at  { Time.current }
  end


end
