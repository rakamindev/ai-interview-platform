# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:scheme) { |n| "tenant-#{n}" }
    name { scheme.titleize }
    identifier { scheme }
    host { "#{scheme}.test" }
  end
end
