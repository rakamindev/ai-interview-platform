# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { 1 }
    status { "pending" }
    candidate_name { "Test Candidate" }

    trait :ended do
      status { "ended" }
      end_reason { "all_covered" }
      started_at { 30.minutes.ago }
      ended_at { Time.current }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { "candidate" }
    text { "A substantive answer." }
  end

  factory :coverage_map do
    session
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    skill_label { "React / Frontend Development Core" }
    is_discovered { false }
    state { "not_yet" }
    probe_count { 0 }
  end
end
