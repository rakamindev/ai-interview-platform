# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "assessor#{n}@example.test" }
    password { 'password123' }
    password_confirmation { 'password123' }
    role { 'admin' }

    trait :non_admin do
      role { 'user' }
    end
  end
end