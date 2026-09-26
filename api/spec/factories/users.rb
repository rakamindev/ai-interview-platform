# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "admin#{n}@example.com" }
    password { "password123" }
    role { "admin" }
    active { true }
  end
end
