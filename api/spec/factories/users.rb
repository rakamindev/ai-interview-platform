# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    password_confirmation { 'password123' }
    role { 'user' }
  end

  factory :admin, class: 'User' do
    sequence(:email) { |n| "admin#{n}@example.com" }
    password { 'password123' }
    password_confirmation { 'password123' }
    role { 'admin' }
  end
end