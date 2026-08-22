# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    email { Faker::Internet.email }
    password { 'password123' }
    role { 'user' }

    trait :admin do
      role { 'admin' }
    end

    trait :user_role do
      role { 'user' }
    end
  end
end
