FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@test-corp.com" }
    password { 'password123' }
    role { 'recruiter' }

    trait :hiring_manager do
      role { 'hiring_manager' }
    end

    trait :assessor do
      role { 'assessor' }
    end

    trait :recruiter do
      role { 'recruiter' }
    end
  end
end
