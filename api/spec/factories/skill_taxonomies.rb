# frozen_string_literal: true

FactoryBot.define do
  factory :skill_taxonomy do
    sequence(:skill_id) { |n| format('SK-TEST-%03d', n) }
    skill_label { 'Test Skill' }
    category    { 'engineering' }
    l1_anchor   { 'Level 1 anchor' }
    l2_anchor   { 'Level 2 anchor' }
    l3_anchor   { 'Level 3 anchor' }
    l4_anchor   { 'Level 4 anchor' }
    l5_anchor   { 'Level 5 anchor' }
  end
end
