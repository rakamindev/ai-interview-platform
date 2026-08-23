# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    association :assessment
    sequence(:skill_id) { |n| "SK-TEST-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'Test scope include' }
    scope_exclude { 'Test scope exclude' }
    l1_anchor { 'L1 anchor text' }
    l2_anchor { 'L2 anchor text' }
    l3_anchor { 'L3 anchor text' }
    l4_anchor { 'L4 anchor text' }
    l5_anchor { 'L5 anchor text' }
    expected_level { nil }
    display_order { 0 }
  end
end
