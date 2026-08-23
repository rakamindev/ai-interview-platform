# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Competency #{n}" }
    expected_level { 3 }
    is_custom { false }
    sequence(:display_order) { |n| n }
    scope_include { "Core architectural patterns and implementations" }
    l1_anchor { "Basic understanding" }
    l2_anchor { "Applies independently" }
    l3_anchor { "Designs complex components" }
    l4_anchor { "Leads architecture" }
    l5_anchor { "Org-wide authority" }
  end
end
