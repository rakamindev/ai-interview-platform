# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 60 }
    language { 'en' }
    tenant_id { 1 }
    created_by { 1 }
    system_prompt { nil }

    trait :with_skills do
      after(:create) do |assessment|
        create_list(:assessment_skill, 3, assessment: assessment)
      end
    end
  end
end
