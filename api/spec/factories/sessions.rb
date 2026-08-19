# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id       { 1 }
    candidate_name  { 'Test Candidate' }
    invite_token    { SecureRandom.hex(32) }
    status          { 'pending' }
    started_at      { nil }
  end

  factory :transcript_turn do
    association :session
    sequence(:turn_number) { |n| n }
    speaker { 'ai' }
    text    { 'Sample turn' }
  end

  factory :coverage_map do
    association :session
    sequence(:skill_label) { |n| "Coverage Skill #{n}" }
    is_discovered { false }
    state         { 'not_yet' }
    probe_count   { 0 }
  end
end