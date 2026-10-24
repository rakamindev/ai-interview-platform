# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:display_order)
    expected_level { 3 }
    l1_anchor { 'L1: recognises basic concepts' }
    l2_anchor { 'L2: applies concepts with guidance' }
    l3_anchor { 'L3: applies concepts independently' }
    l4_anchor { 'L4: optimises and mentors others' }
    l5_anchor { 'L5: sets org-wide direction' }
  end
end
