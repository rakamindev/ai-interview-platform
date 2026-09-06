# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Test Corp #{n}" }
    sequence(:scheme)     { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    sequence(:host)       { |n| "host-#{n}.test" }
  end
end
