# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    sequence(:candidate_name) { |n| "Kandidat Contoh #{n}" }
    status           { 'ended' }
    end_reason       { 'all_covered' }
    started_at       { 40.minutes.ago }
    ended_at         { 10.minutes.ago }
    duration_seconds { 1800 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'Contoh jawaban kandidat.' }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Contoh Skill #{n}" }
    state         { 'covered' }
    probe_count   { 3 }
    is_discovered { false }
  end
end
