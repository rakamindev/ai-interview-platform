# frozen_string_literal: true

FactoryBot.define do
  sequence(:organization_sequence) { |n| n }

  factory :organization do
    transient do
      sequence_number { generate(:organization_sequence) }
    end

    name { "Assessment Org #{sequence_number}" }
    scheme { "assessment-org-#{sequence_number}" }
    identifier { "assessment-org-#{sequence_number}" }
    host { "assessment-org-#{sequence_number}.test" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    tenant_id { create(:organization).id }
    created_by { 1 }
    name { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom { false }
    scope_include { 'Relevant practical behavior' }
    scope_exclude { 'Unrelated behavior' }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Handles routine work' }
    l3_anchor { 'Handles complex work' }
    l4_anchor { 'Defines standards' }
    l5_anchor { 'Shapes organization practice' }
    expected_level { 3 }
    sequence(:display_order)
  end
end
