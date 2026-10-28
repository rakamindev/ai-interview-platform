# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Fake Org #{n}" }
    sequence(:scheme) { |n| "fake-org-#{n}" }
    identifier { scheme }
    host { "#{scheme}.example.test" }
    alias_hosts { [] }
    config { {} }
  end
end
