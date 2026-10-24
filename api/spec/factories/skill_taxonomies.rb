# frozen_string_literal: true

FactoryBot.define do
  factory :skill_taxonomy do
    sequence(:skill_id) { |n| format('SK-TEST-%03d', n) }
    sequence(:skill_label) { |n| "Test Skill #{n}" }
    category { 'engineering' }
    l1_anchor { 'L1: recognises basic concepts' }
    l2_anchor { 'L2: applies concepts with guidance' }
    l3_anchor { 'L3: applies concepts independently' }
    l4_anchor { 'L4: optimises and mentors others' }
    l5_anchor { 'L5: sets org-wide direction' }
  end
end
