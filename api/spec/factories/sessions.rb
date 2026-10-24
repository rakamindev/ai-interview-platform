# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { 'Test Candidate' }

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      end_reason { 'manual_assessor' }
      started_at { 1.hour.ago }
      ended_at { Time.current }
      duration_seconds { 3600 }
    end
  end
end
