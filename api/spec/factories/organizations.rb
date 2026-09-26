# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Tenant #{n}" }
    sequence(:scheme) { |n| "tenant-#{n}" }
    sequence(:identifier) { |n| "tenant-#{n}" }
    sequence(:host) { |n| "tenant-#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end
end
