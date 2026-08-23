# frozen_string_literal: true

FactoryBot.define do
  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "SK-TAX-#{n.to_s.rjust(3, '0')}" }
    sequence(:skill_label) { |n| "Taxonomy Skill #{n}" }
    category { 'engineering' }
    scope_include { 'Test scope' }
    scope_exclude { 'Test exclude' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end
end
