# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Organization #{n}" }
    sequence(:scheme) { |n| "org-scheme-#{n}" }
    sequence(:identifier) { |n| "org-identifier-#{n}" }
    sequence(:host) { |n| "org-#{n}.example.test" }
  end
end
