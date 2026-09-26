# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    candidate_name { 'Test Candidate' }
    status { 'ended' }
    end_reason { 'all_covered' }
  end
end
