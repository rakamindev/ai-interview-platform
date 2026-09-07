# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Senior Frontend Engineer #{n}" }
    time_limit_min  { 45 }
    language        { 'en' }
    created_by      { 1 }

    transient do
      skills_count { 0 }
    end

    after(:build) do |assessment, evaluator|
      evaluator.skills_count.times do |i|
        assessment.assessment_skills << build(:assessment_skill, display_order: i)
      end
    end

    trait :with_prd02_skills do
      after(:build) do |assessment|
        assessment.assessment_skills << build(:assessment_skill,
                                              skill_id:       'SK-ENG-001',
                                              skill_label:    'React / Frontend Development Core',
                                              expected_level: 3,
                                              display_order:  0)
        assessment.assessment_skills << build(:assessment_skill, :custom,
                                              skill_label:    'Communication',
                                              expected_level: 3,
                                              display_order:  1)
        assessment.assessment_skills << build(:assessment_skill,
                                              skill_id:       'SK-ENG-003',
                                              skill_label:    'System Design',
                                              expected_level: 2,
                                              display_order:  2)
      end
    end
  end

  factory :assessment_skill do
    association :assessment
    sequence(:skill_id)    { |n| format('SK-ENG-%03d', n) }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_custom      { false }
    scope_include  { 'What this skill covers.' }
    scope_exclude  { 'What does not count for this skill.' }
    l1_anchor      { 'L1 behaviour.' }
    l2_anchor      { 'L2 behaviour.' }
    l3_anchor      { 'L3 behaviour.' }
    l4_anchor      { 'L4 behaviour.' }
    l5_anchor      { 'L5 behaviour.' }
    expected_level { 3 }
    display_order  { 0 }

    trait :custom do
      skill_id  { nil }
      is_custom { true }
    end
  end
end
