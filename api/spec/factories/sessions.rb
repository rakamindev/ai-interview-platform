# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    status { 'ended' }
    end_reason { 'all_covered' }
    sequence(:candidate_id)
    sequence(:candidate_name) { |n| "Candidate #{n}" }
  end
end
