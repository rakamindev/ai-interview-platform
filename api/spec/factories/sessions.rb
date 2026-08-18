# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    association :assessment
    candidate_name { 'Budi Santoso' }
    status { 'pending' }
    expires_at { 5.minutes.from_now }

    trait :expired do
      expires_at { 5.minutes.ago }
      status { 'expired' }
    end

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      ended_at { Time.current }
      end_reason { 'all_covered' }
    end
  end
end
