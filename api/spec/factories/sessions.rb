# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id { assessment.tenant_id }
    candidate_id { 9001 }
    candidate_name { 'Test Candidate' }
    status { 'pending' }
  end
end
