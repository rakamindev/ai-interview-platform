# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user-#{n}@example.com" }
    password { "password123" }
    password_confirmation { "password123" }
    role { "admin" }

    trait :assessor do
      role { "admin" }
    end

    trait :regular do
      role { "user" }
    end
  end
end
