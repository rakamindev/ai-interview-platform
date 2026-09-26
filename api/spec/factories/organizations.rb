# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Test Company #{n}" }
    sequence(:scheme) { |n| "test-company-#{n}" }
    identifier { scheme }
    host { "#{scheme}.example.com" }
  end
end
