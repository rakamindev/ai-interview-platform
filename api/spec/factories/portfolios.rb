# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    tenant_id { session.tenant_id }
    sequence(:candidate_id)
    generation_status { "complete" }
  end
end
