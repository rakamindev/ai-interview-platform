# frozen_string_literal: true

FactoryBot.define do
  factory :skill_taxonomy do
    sequence(:skill_id) { |n| "TECH_#{n}" }
    sequence(:skill_label) { |n| "Technology #{n}" }
    category { 'engineering' }
    l1_anchor { 'Basic familiarity and conceptual understanding' }
    l2_anchor { 'Can apply patterns with standard guidance' }
    l3_anchor { 'Independent implementation and operational ownership' }
    l4_anchor { 'System design optimization and deep troubleshooting' }
    l5_anchor { 'Domain mastery, architectural vision, and mentoring' }
  end
end
