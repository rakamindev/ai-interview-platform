# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Frontend Engineer Assessment #{n}" }
    time_limit_min { 30 }
    language { "en" }
    system_prompt { "You are evaluating candidate skills." }
  end

  factory :assessment_skill do
    association :assessment
    skill_id { "SK-ENG-001" }
    skill_label { "React / Frontend Development" }
    is_custom { false }
    l1_anchor { "Basic understanding of JSX" }
    l2_anchor { "Independent execution on standard components" }
    l3_anchor { "Complex state management and performance optimization" }
    l4_anchor { "Architecture and design pattern standards" }
    l5_anchor { "Domain authority and framework design" }
    expected_level { 3 }
    display_order { 1 }
  end
end
