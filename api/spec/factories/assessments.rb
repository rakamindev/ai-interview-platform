# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    # TenantScoped assigns tenant_id from Current when it is not given, so
    # passing it explicitly keeps these records independent of request state.
    # `tenant_id` and `created_by` are bare columns, not associations.
    tenant_id { create(:organization).id }
    created_by { create(:user).id }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { 'en' }

    transient do
      skill_count { 2 }
    end

    trait :with_skills do
      after(:create) do |assessment, evaluator|
        create_list(:assessment_skill, evaluator.skill_count, assessment: assessment)
      end
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'Needs explicit guidance' }
    l2_anchor { 'Works independently on routine scope' }
    l3_anchor { 'Handles ambiguous scope and trade-offs' }
    l4_anchor { 'Defines standards and reusable systems' }
    l5_anchor { 'Shapes how the skill is practised org-wide' }
    display_order { 0 }
  end
end