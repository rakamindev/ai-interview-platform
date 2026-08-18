# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name)   { |n| "Assessment #{n}" }
    time_limit_min    { 30 }
    language          { "en" }
    tenant_id         { 1 }
    created_by        { 1 }

    trait :with_skill do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment)
      end
    end
  end

  factory :assessment_skill do
    association :assessment
    sequence(:skill_id)    { |n| "SK-ENG-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom      { false }
    expected_level { 3 }
    display_order  { 0 }
    l1_anchor { "L1 anchor" }
    l2_anchor { "L2 anchor" }
    l3_anchor { "L3 anchor" }
    l4_anchor { "L4 anchor" }
    l5_anchor { "L5 anchor" }
  end
end
