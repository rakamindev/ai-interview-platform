# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    association :assessment
    sequence(:skill_label) { |n| "Assessment Skill #{n}" }
    sequence(:skill_id)    { |n| "SK-ASM-#{n}" }
    sequence(:display_order) { |n| n }
    expected_level { 3 }
    l1_anchor { 'Basic awareness' }
    l2_anchor { 'Applies standard patterns' }
    l3_anchor { 'Solves complex problems' }
    l4_anchor { 'Designs architectures' }
    l5_anchor { 'Industry authority' }
  end
end
