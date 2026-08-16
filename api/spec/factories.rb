# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { 'Frontend Engineer' }
    time_limit_min { 30 }
    language { 'en' }

    trait :with_skill do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment)
      end
    end
  end

  factory :assessment_skill do
    assessment
    skill_id { 'sk-eng-001' }
    skill_label { 'React Development' }
    is_custom { false }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
    expected_level { 3 }
    display_order { 0 }
  end

  factory :session do
    tenant_id { 1 }
    assessment
    status { 'ended' }
    end_reason { 'manual_candidate' }
    started_at { 10.minutes.ago }
    ended_at { Time.current }
    duration_seconds { 600 }

    trait :with_coverage do
      after(:create) do |session|
        skill = create(:assessment_skill, assessment: session.assessment)
        create(:coverage_map,
               session: session,
               skill_id: skill.skill_id,
               skill_label: skill.skill_label,
               state: 'covered',
               probe_count: 3)
      end
    end
  end

  factory :coverage_map do
    session
    skill_id { 'sk-eng-001' }
    skill_label { 'React Development' }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
  end

  factory :portfolio do
    session
    generation_status { 'pending' }
  end

  factory :portfolio_skill do
    portfolio
    skill_id { 'sk-eng-001' }
    skill_label { 'React Development' }
    is_discovered { false }
    assessment_status { 'assessed' }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Candidate explained component lifecycle clearly.'] }
    competency_summary { 'Solid mid-level React patterns.' }
    coverage_state { 'covered' }
    probe_count { 3 }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { 'Senior Frontend Engineer' }
    culture_dimensions { 'Collaborative, product-minded' }
    competency_expectations { 'Ship reliable UI' }

    after(:create) do |vacancy|
      create(:vacancy_skill, vacancy: vacancy)
    end
  end

  factory :vacancy_skill do
    vacancy
    skill_id { 'sk-eng-001' }
    skill_label { 'React Development' }
    expected_level { 3 }
  end
end
