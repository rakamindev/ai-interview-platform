# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    name { 'Senior React Developer' }
    time_limit_min { 45 }
    tenant_id { 1 }
    created_by { 1 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label { 'React Framework' }
    is_custom { false }
    l1_anchor { 'Basic concepts' }
    l2_anchor { 'Routine tasks' }
    l3_anchor { 'Independent delivery' }
    l4_anchor { 'Architectural decisions' }
    l5_anchor { 'Domain authority' }
    expected_level { 3 }
  end
end
