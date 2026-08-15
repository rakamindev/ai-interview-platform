# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "assessor#{n}@example.test" }
    password         { 'correct-horse-battery-staple' }
    role             { 'admin' }
  end
end
