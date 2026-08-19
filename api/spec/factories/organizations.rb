FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Test Org #{n}" }
    sequence(:scheme) { |n| "test-org-#{n}" }
    sequence(:identifier) { |n| "test-org-#{n}" }
    host { "localhost" }
    alias_hosts { [] }
    config { {} }
  end
end
