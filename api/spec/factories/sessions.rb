# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id { assessment.tenant_id }
    status { "ended" }
    candidate_name { "Test Candidate" }
    started_at { 1.hour.ago }
    ended_at { 5.minutes.ago }
    duration_seconds { 3300 }
  end
end
