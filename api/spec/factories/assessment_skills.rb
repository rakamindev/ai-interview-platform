# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    association :assessment
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'In scope description.' }
    scope_exclude { 'Out of scope description.' }
    l1_anchor { 'L1 anchor.' }
    l2_anchor { 'L2 anchor.' }
    l3_anchor { 'L3 anchor.' }
    l4_anchor { 'L4 anchor.' }
    l5_anchor { 'L5 anchor.' }
    expected_level { 3 }
    display_order { 0 }
  end
end
