# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "SK-TEST-#{n}" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    is_custom { false }
    l1_anchor { "L1 anchor text" }
    l2_anchor { "L2 anchor text" }
    l3_anchor { "L3 anchor text" }
    l4_anchor { "L4 anchor text" }
    l5_anchor { "L5 anchor text" }
    expected_level { 3 }
  end
end
