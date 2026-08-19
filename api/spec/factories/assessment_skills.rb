# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    association :assessment
    sequence(:skill_id) { |n| "sk-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'General scope' }
    scope_exclude { 'Out of scope' }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Works independently on routine tasks' }
    l3_anchor { 'Handles complex ambiguous scope' }
    l4_anchor { 'Defines standards and systems' }
    l5_anchor { 'Org-level authority' }
    expected_level { nil }
    sequence(:display_order) { |n| n }
  end
end
