FactoryBot.define do
  factory :organization do
    sequence(:id) { |n| 100 + n }
    name { 'Test Org' }
    sequence(:identifier) { |n| "test-org-#{n}" }
    sequence(:scheme) { |n| "test-scheme-#{n}" }
    host { 'test.example.com' }
  end
end
