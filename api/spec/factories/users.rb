# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "admin#{n}@example.com" }
    password { "correct-horse-battery-staple" }
    role { "admin" }
    organization

    trait :non_admin do
      role { "user" }
    end
  end
end