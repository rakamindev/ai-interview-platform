# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    sequence(:created_by) { |n| n + 1000 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
    system_prompt { nil }

    trait :with_skills do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment, display_order: 1)
        create(:assessment_skill, assessment: assessment, display_order: 2)
      end
    end

    trait :short do
      time_limit_min { 10 }
    end

    trait :indonesian do
      language { 'id' }
    end
  end
end
