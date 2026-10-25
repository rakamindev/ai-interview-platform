FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Tenant #{n}" }
    sequence(:scheme)     { |n| "tenant-#{n}" }
    sequence(:identifier) { |n| "tenant-#{n}" }
    host                  { "localhost" }
  end
end
