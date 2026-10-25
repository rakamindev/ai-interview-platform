FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { 'en' }
    tenant_id { 1 }
    created_by { 1 }

    after(:build) do |assessment|
      Current.tenant_id = assessment.tenant_id || 1
    end
  end
end
