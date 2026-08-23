# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id { Current.tenant_id || 1 }
    candidate_id { nil }
    invite_token { nil }
    status { 'pending' }
    end_reason { nil }
    started_at { nil }
    ended_at { nil }
    duration_seconds { nil }
    candidate_name { nil }

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      started_at { 30.minutes.ago }
      ended_at { Time.current }
      duration_seconds { 1800 }
      end_reason { 'manual_assessor' }
    end

    trait :failed do
      status { 'failed' }
      started_at { 10.minutes.ago }
      ended_at { Time.current }
      end_reason { 'error' }
    end

    trait :with_candidate do
      candidate_id { 42 }
      candidate_name { 'John Doe' }
    end
  end
end
