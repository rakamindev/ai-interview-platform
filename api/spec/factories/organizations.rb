# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Organization #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:host) { |n| "org-#{n}.example.com" }
    sequence(:identifier) { |n| "org-#{n}" }
  end
end
