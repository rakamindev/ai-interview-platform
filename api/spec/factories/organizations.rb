# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Test Org #{n}" }
    sequence(:scheme) { |n| "test-org-#{n}" }
    sequence(:identifier) { |n| "test-org-#{n}" }
    sequence(:host) { |n| "test-org-#{n}.example.com" }
  end
end
