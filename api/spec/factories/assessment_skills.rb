# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    association :assessment
    skill_id { "SK-TEST-001" }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    l1_anchor { "L1" }
    l2_anchor { "L2" }
    l3_anchor { "L3" }
    l4_anchor { "L4" }
    l5_anchor { "L5" }
    display_order { 0 }
  end
end
