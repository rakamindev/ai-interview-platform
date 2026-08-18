# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    password { 'password123' }
    password_confirmation { 'password123' }
    role { 'admin' }
  end

  factory :assessment do
    name { 'Frontend Engineer Assessment' }
    time_limit_min { 30 }
    language { 'en' }
    tenant_id { 1 }
    created_by { 1 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
    display_order { 1 }
    l1_anchor { 'Basic understanding' }
    l2_anchor { 'Can work with guidance' }
    l3_anchor { 'Proficient independent' }
    l4_anchor { 'Advanced expert' }
    l5_anchor { 'Industry thought leader' }
  end

  factory :session do
    assessment
    status { 'pending' }
    tenant_id { 1 }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { 'high' }
    competency_summary { 'Demonstrated strong skills.' }
    evidence { ['quote 1'] }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { 'Candidate proved higher capability.' }
    overridden_by { 1 }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state { 'not_yet' }
    probe_count { 0 }
    is_discovered { false }
  end

  factory :vacancy do
    role_title { 'Senior React Developer' }
    culture_dimensions { 'High ownership and fast execution.' }
    competency_expectations { 'Deep knowledge of modern web stack.' }
    tenant_id { 1 }
    created_by { 1 }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 4 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons do
      [
        {
          'skill_label' => 'React',
          'expected_level' => 4,
          'candidate_level' => 3,
          'result' => 'gap',
          'delta' => -1
        }
      ]
    end
    culture_narrative { 'Good alignment.' }
    overall_narrative { 'Recommend hire with mentoring.' }
  end
end
