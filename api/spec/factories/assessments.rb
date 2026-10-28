# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    transient do
      organization { association :organization }
    end

    tenant_id      { organization.id }
    created_by     { 1 }
    name           { 'Contoh Assessment Backend' }
    time_limit_min { 30 }
    language       { 'id' }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label)   { |n| "Contoh Skill #{n}" }
    sequence(:display_order) { |n| n }
    is_custom { true }
    l1_anchor { 'Contoh anchor L1' }
    l2_anchor { 'Contoh anchor L2' }
    l3_anchor { 'Contoh anchor L3' }
    l4_anchor { 'Contoh anchor L4' }
    l5_anchor { 'Contoh anchor L5' }
  end
end
