# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { 'Test Corp' }
    sequence(:scheme) { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    sequence(:host) { |n| "org#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end
end
