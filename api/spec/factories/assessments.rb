# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min  { 45 }
    language        { 'en' }
    tenant_id       { 1 }
    created_by      { 1 }
  end

  factory :assessment_skill do
    association :assessment
    sequence(:skill_id)  { |n| "SK-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom      { false }
    l1_anchor      { 'L1 anchor text' }
    l2_anchor      { 'L2 anchor text' }
    l3_anchor      { 'L3 anchor text' }
    l4_anchor      { 'L4 anchor text' }
    l5_anchor      { 'L5 anchor text' }
    expected_level { 3 }
    display_order  { 0 }
  end
end