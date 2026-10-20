# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { 'Candidate Example' }
    status { 'ended' }
    end_reason { 'all_covered' }
    started_at { 40.minutes.ago }
    ended_at { 5.minutes.ago }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state { 'covered' }
    probe_count { 4 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'candidate' }
    text { 'I split the service by bounded context.' }
  end
end
