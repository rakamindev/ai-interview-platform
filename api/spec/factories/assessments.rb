# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { organization.id }
    created_by { 1 }
    name { 'Backend Engineer' }
    time_limit_min { 30 }

    transient do
      organization { create(:organization) }
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'Needs guidance' }
    l2_anchor { 'Works independently on routine scope' }
    l3_anchor { 'Handles ambiguous scope' }
    l4_anchor { 'Sets standards' }
    l5_anchor { 'Shapes the practice' }
    expected_level { 3 }
  end
end
