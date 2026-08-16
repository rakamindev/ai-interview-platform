# frozen_string_literal: true

FactoryBot.define do
  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "ruby-#{n}" }
    sequence(:skill_label) { |n| "Ruby #{n}" }
    category { 'engineering' }
    scope_include { 'In scope text' }
    scope_exclude { 'Out of scope text' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end
end
