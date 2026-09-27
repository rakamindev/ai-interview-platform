# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    role { 'user' }
    organization { nil }

    trait :admin do
      role { 'admin' }
    end

    trait :assessor do
      role { 'assessor' }
    end
  end
end
