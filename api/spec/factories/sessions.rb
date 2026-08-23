# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { "Budi Santoso" }
    sequence(:invite_token) { SecureRandom.hex(32) }
    status { "pending" }

    trait :active do
      status { "active" }
      started_at { Time.current }
    end

    trait :ended do
      status { "ended" }
      end_reason { "manual_assessor" }
      started_at { 45.minutes.ago }
      ended_at { Time.current }
      duration_seconds { 2700 }
    end
  end
end
