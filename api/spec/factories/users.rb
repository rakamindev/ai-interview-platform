# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "assessor#{n}@example.com" }
    password { 'password123' }
    role { 'admin' }
  end
end
