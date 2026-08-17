FactoryBot.define do
  factory :session do
    association :assessment
    sequence(:candidate_name) { |n| "Candidate #{n}" }
    status { "pending" }
    started_at { nil }

    trait :ended do
      status { "ended" }
      started_at { 2.days.ago }
    end

    trait :failed do
      status { "failed" }
      started_at { 2.days.ago }
    end

    trait :active do
      status { "active" }
      started_at { 1.hour.ago }
    end
  end
end
