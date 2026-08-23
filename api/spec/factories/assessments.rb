# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { "en" }

    trait :with_skills do
      transient do
        skills_count { 2 }
      end

      after(:create) do |assessment, evaluator|
        create_list(:assessment_skill, evaluator.skills_count, assessment:)
      end
    end
  end
end
