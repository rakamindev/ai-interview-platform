# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@test-corp.com" }
    password { 'password123' }
    role { 'admin' }
  end
end
