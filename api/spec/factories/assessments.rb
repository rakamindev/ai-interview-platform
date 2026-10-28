# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { "Senior Frontend Engineer" }
    time_limit_min { 45 }
    language { "en" }

    trait :with_skill do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment)
      end
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    skill_label { "React / Frontend Development Core" }
    is_custom { false }
    expected_level { 3 }
    display_order { 0 }
    l1_anchor { "Implements components from specs with close review." }
    l2_anchor { "Builds routine features independently." }
    l3_anchor { "Designs and builds complex features end-to-end." }
    l4_anchor { "Defines frontend standards for the team." }
    l5_anchor { "Defines frontend architecture strategy for the org." }
  end
end
