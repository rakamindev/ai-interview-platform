# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id      { Current.tenant_id }
    created_by     { 1 }
    sequence(:name) { |n| "Backend Engineer Assessment #{n}" }
    time_limit_min { 30 }
    language       { 'en' }

    trait :with_skills do
      transient { skill_count { 3 } }

      after(:create) do |assessment, evaluator|
        evaluator.skill_count.times do |i|
          create(:assessment_skill, assessment: assessment, display_order: i)
        end
      end
    end
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id)    { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom              { false }
    scope_include          { 'Designing, building and debugging production services.' }
    scope_exclude          { 'Pure UI styling work.' }
    l1_anchor              { 'Executes with explicit guidance and close review.' }
    l2_anchor              { 'Executes independently on routine scope.' }
    l3_anchor              { 'Executes complex, ambiguous scope. Makes tradeoffs.' }
    l4_anchor              { 'Defines standards and creates reusable systems.' }
    l5_anchor              { 'Org-level authority. Shapes how the skill is practiced.' }
    expected_level         { 3 }
    display_order          { 0 }
  end
end
