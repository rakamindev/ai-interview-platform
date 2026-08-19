# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    association :assessment
    candidate_id { 9001 }
    candidate_name { 'John Doe' }
    status { 'pending' }
    started_at { nil }
    ended_at { nil }
    duration_seconds { nil }

    trait :active do
      status { 'active' }
      started_at { 5.minutes.ago }
    end

    trait :ended do
      status { 'ended' }
      started_at { 30.minutes.ago }
      ended_at { Time.current }
      duration_seconds { 1800 }
      end_reason { 'manual_assessor' }
    end

    trait :with_portfolio do
      after(:create) do |session|
        create(:portfolio, session: session)
      end
    end

    trait :with_transcript do
      after(:create) do |session|
        create(:transcript_turn, session: session, turn_number: 1, speaker: 'ai', text: 'Hello!')
        create(:transcript_turn, session: session, turn_number: 2, speaker: 'candidate', text: 'Hi there!')
      end
    end

    trait :with_coverage do
      after(:create) do |session|
        create(:coverage_map, session: session, skill_label: 'React', state: 'not_yet')
      end
    end
  end
end
