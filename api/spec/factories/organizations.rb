# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Test Org #{n}" }
    sequence(:scheme) { |n| "test-org-#{n}" }
    sequence(:identifier) { |n| "test-org-#{n}" }
    sequence(:host) { |n| "test-org-#{n}.localhost" }
    alias_hosts { [] }
    config { {} }

    trait :rival do
      name { "Rival Corp" }
      scheme { "rival-corp" }
      identifier { "rival-corp" }
      host { "rival-corp.localhost" }
    end
  end
end
