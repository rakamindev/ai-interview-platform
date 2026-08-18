FactoryBot.define do
  factory :session do
    association :assessment
    status { 'active' }
    candidate_name { 'Test Candidate' }

    trait :ended do
      status { 'ended' }
      ended_at { Time.current }
      end_reason { 'manual_candidate' }
    end
  end
end
