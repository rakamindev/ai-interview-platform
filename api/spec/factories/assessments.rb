# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 101 }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
  end

  factory :assessment_skill do
    association :assessment
    skill_id { 'backend-ruby' }
    skill_label { 'Ruby' }
    l1_anchor { 'L1' }
    l2_anchor { 'L2' }
    l3_anchor { 'L3' }
    l4_anchor { 'L4' }
    l5_anchor { 'L5' }
    expected_level { 3 }
    display_order { 1 }
  end
end
