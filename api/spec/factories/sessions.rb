# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id      { Current.tenant_id }
    assessment     { association :assessment, tenant_id: tenant_id }
    candidate_id   { nil }
    candidate_name { 'Budi Santoso' } # synthetic — never a real person
    status         { 'pending' }

    trait :active do
      status     { 'active' }
      started_at { 30.minutes.ago }
    end

    trait :ended do
      status           { 'ended' }
      end_reason       { 'manual_assessor' }
      started_at       { 45.minutes.ago }
      ended_at         { 5.minutes.ago }
      duration_seconds { 2_400 }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker                { 'candidate' }
    text                   { 'We sharded the write path and moved reads onto a replica.' }
    audio_start_ms         { 0 }
    audio_end_ms           { 4_200 }
  end

  factory :coverage_map do
    session
    sequence(:skill_id)    { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered          { false }
    state                  { 'covered' }
    probe_count            { 3 }
    last_signal            { 'Candidate described a concrete tradeoff.' }

    # The centrepiece of the P0-1 defect: a skill nobody ever asked about.
    trait :not_probed do
      state       { 'not_yet' }
      probe_count { 0 }
      last_signal { nil }
    end

    trait :partial do
      state       { 'partial' }
      probe_count { 2 }
    end

    trait :discovered do
      is_discovered { true }
      skill_id      { nil }
      state         { 'initiated' }
      probe_count   { 1 }
    end
  end
end
