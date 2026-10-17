# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { 'Test Corp' }
    scheme { 'test-corp' }
    identifier { 'test-corp' }
    host { 'localhost' }
  end

  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { Faker::Job.title }
    time_limit_min { 45 }
    language { 'en' }
  end

  factory :session do
    tenant_id { 1 }
    association :assessment
    status { 'pending' }
  end

  factory :assessment_skill do
    association :assessment
    skill_label { Faker::Job.title }
    is_custom { true }
    l1_anchor { 'Level 1 behavior' }
    l2_anchor { 'Level 2 behavior' }
    l3_anchor { 'Level 3 behavior' }
    l4_anchor { 'Level 4 behavior' }
    l5_anchor { 'Level 5 behavior' }
    expected_level { 3 }
    display_order { 0 }
  end
end