# frozen_string_literal: true

# NOTE: These factories must always be used inside `with_tenant(org)` (see
# spec/support/tenant_helpers.rb) because Assessment/Vacancy/Session carry a
# default_scope that filters on the tenant stored in RequestStore.

FactoryBot.define do
  factory :organization, class: 'Organization' do
    name      { 'Test Corp' }
    sequence(:scheme)     { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    host      { 'localhost' }
    alias_hosts { [] }
    config    { {} }
  end

  factory :skill_taxonomy, class: 'SkillTaxonomy' do
    sequence(:skill_id)  { |n| "SK-TEST-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    category { 'engineering' }
    scope_include { 'Relevant scope' }
    scope_exclude { 'Excluded scope' }
    l1_anchor { 'L1 anchor' }
    l2_anchor { 'L2 anchor' }
    l3_anchor { 'L3 anchor' }
    l4_anchor { 'L4 anchor' }
    l5_anchor { 'L5 anchor' }
  end

  factory :assessment, class: 'Assessment' do
    name { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language { 'en' }
    created_by { 1 }

    transient do
      tenant { nil }
    end

    after(:build) do |assessment, evaluator|
      assessment.tenant_id ||= evaluator.tenant&.id
    end

    trait :with_skill do
      after(:build) do |assessment|
        assessment.assessment_skills << build(:assessment_skill, assessment: assessment)
      end
    end

    trait :with_skills do
      after(:build) do |assessment|
        assessment.assessment_skills << build(:assessment_skill, assessment: assessment)
        assessment.assessment_skills << build(:assessment_skill, :communication, assessment: assessment)
        assessment.assessment_skills << build(:assessment_skill, :system_design, assessment: assessment)
      end
    end
  end

  factory :assessment_skill, class: 'AssessmentSkill' do
    assessment
    skill_id { 'SK-ENG-001' }
    skill_label { 'React / Frontend Development Core' }
    is_custom { false }
    scope_include { 'Component design, state management, hooks, performance' }
    scope_exclude { 'Backend APIs' }
    l1_anchor { 'Implements components with close review' }
    l2_anchor { 'Builds routine features independently' }
    l3_anchor { 'Designs complex features end-to-end' }
    l4_anchor { 'Defines frontend standards' }
    l5_anchor { 'Defines frontend architecture strategy' }
    expected_level { 3 }
    display_order { 0 }

    trait :communication do
      skill_id { 'SK-SOFT-001' }
      skill_label { 'Communication' }
      display_order { 1 }
    end

    trait :system_design do
      skill_id { 'SK-ENG-003' }
      skill_label { 'System Design & Architecture' }
      expected_level { 2 }
      display_order { 2 }
    end
  end

  factory :session, class: 'Session' do
    assessment

    transient do
      tenant { nil }
    end

    candidate_id { nil }
    candidate_name { 'Ahmad Rizky' }
    status { 'pending' }
    invite_token { SecureRandom.hex(32) }

    after(:build) do |sess, evaluator|
      sess.tenant_id ||= evaluator.tenant&.id || sess.assessment&.tenant_id
    end

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      started_at { 30.minutes.ago }
      ended_at { Time.current }
      duration_seconds { 1800 }
      end_reason { 'all_covered' }
    end
  end

  factory :coverage_map, class: 'CoverageMap' do
    session
    skill_id { 'SK-ENG-001' }
    skill_label { 'React / Frontend Development Core' }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
  end

  factory :portfolio, class: 'Portfolio' do
    session
    generation_status { 'pending' }
  end

  factory :portfolio_skill, class: 'PortfolioSkill' do
    portfolio
    skill_id { 'SK-ENG-001' }
    skill_label { 'React / Frontend Development Core' }
    is_discovered { false }
    assessed { true }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['"I built a real-time dashboard."'] }
    competency_summary { 'Demonstrates strong L3 frontend skills.' }

    trait :unassessed do
      assessed { false }
      ai_level { nil }
      ai_confidence { nil }
      competency_summary { PortfolioSkill.not_assessed_summary }
    end
  end

  factory :vacancy, class: 'Vacancy' do
    role_title { 'Senior Frontend Engineer' }
    culture_dimensions { 'ownership, directness, async-first' }
    competency_expectations { 'Ship quality frontends' }
    created_by { 1 }

    transient do
      tenant { nil }
    end

    after(:build) do |vacancy, evaluator|
      vacancy.tenant_id ||= evaluator.tenant&.id
    end

    trait :with_skill do
      after(:build) do |vacancy|
        vacancy.vacancy_skills << build(:vacancy_skill, vacancy: vacancy)
      end
    end
  end

  factory :vacancy_skill, class: 'VacancySkill' do
    vacancy
    skill_id { 'SK-ENG-001' }
    skill_label { 'React / Frontend Development Core' }
    expected_level { 3 }
  end

  factory :transcript_turn, class: 'TranscriptTurn' do
    session
    turn_number { 1 }
    speaker { 'candidate' }
    text { 'At my last job we built a real-time logistics dashboard.' }
  end
end
