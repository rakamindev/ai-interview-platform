FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Senior Engineer ##{n}" }
    time_limit_min { 45 }
    language { "en" }
  end
end
