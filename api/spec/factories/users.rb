# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "assessor#{n}@test.com" }
    password         { 'password123' }
    role             { 'admin' }

    trait :viewer do
      role { 'user' }
    end
  end
end
