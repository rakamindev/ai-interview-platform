# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    sequence(:candidate_name) { |n| "Candidate #{n}" }
    status { 'pending' }
    tenant_id { assessment.tenant_id }

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      started_at { 30.minutes.ago }
      ended_at { Time.current }
      end_reason { 'all_covered' }
    end

    trait :failed do
      status { 'failed' }
      end_reason { 'error' }
    end
  end
end
