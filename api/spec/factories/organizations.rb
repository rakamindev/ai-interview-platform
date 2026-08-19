# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Org #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host) { |n| "org#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end
end
