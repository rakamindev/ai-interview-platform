# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    role { 'assessor' }

    trait :admin do
      role { 'admin' }
    end

    trait :user do
      role { 'user' }
    end
  end
end
