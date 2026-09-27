# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status { 'pending' }
    candidate_name { 'Alice Candidate' }
  end
end
