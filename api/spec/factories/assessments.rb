# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Software Engineer Assessment #{n}" }
    time_limit_min { 45 }
    language { "en" }

    trait :with_skills do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment, skill_label: 'React Core', expected_level: 3, display_order: 0)
        create(:assessment_skill, assessment: assessment, skill_label: 'System Design', expected_level: 4, display_order: 1)
      end
    end
  end
end
