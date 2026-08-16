# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    assessment
    sequence(:candidate_name) { |n| "Candidate #{n}" }
    candidate_id { 1 }
    status { 'ended' }
  end
end
