# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { Faker::Job.title }
    time_limit_min { 45 }
    language { 'en' }
  end

  factory :assessment_skill do
    assessment
    skill_id { Faker::Alphanumeric.alphanumeric(number: 8).upcase }
    skill_label { Faker::ProgrammingLanguage.name }
    is_custom { false }
    scope_include { 'Core concepts' }
    scope_exclude { 'Out of scope' }
    l1_anchor { 'Understands with guidance.' }
    l2_anchor { 'Executes routine work.' }
    l3_anchor { 'Handles ambiguity.' }
    l4_anchor { 'Defines standards.' }
    l5_anchor { 'Org authority.' }
    expected_level { 3 }
    display_order { 0 }
  end

  factory :session do
    assessment
    tenant_id { 1 }
    candidate_id { 1 }
    candidate_name { Faker::Name.name }
    invite_token { SecureRandom.hex(32) }
    status { 'pending' }
  end

  factory :transcript_turn do
    session
    turn_number { 1 }
    speaker { 'candidate' }
    text { Faker::Lorem.sentence }
  end

  factory :portfolio do
    session
    tenant_id { 1 }
    candidate_id { 1 }
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    skill_id { Faker::Alphanumeric.alphanumeric(number: 8).upcase }
    skill_label { Faker::ProgrammingLanguage.name }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'medium' }
    evidence { [] }
    evidence_provenance { [] }
    competency_summary { Faker::Lorem.sentence }
  end

  factory :coverage_map do
    session
    skill_id { Faker::Alphanumeric.alphanumeric(number: 8).upcase }
    skill_label { Faker::ProgrammingLanguage.name }
    is_discovered { false }
    state { 'not_yet' }
    probe_count { 0 }
  end

  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { Faker::Job.title }
    culture_dimensions { 'Ownership, directness' }
    competency_expectations { 'Strong communicator' }
  end

  factory :vacancy_skill do
    vacancy
    skill_id { Faker::Alphanumeric.alphanumeric(number: 8).upcase }
    skill_label { Faker::ProgrammingLanguage.name }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [] }
    generation_status { 'complete' }
  end

  factory :assessor_override do
    portfolio_skill
    outcome { 'adjusted' }
    ai_level { 3 }
    reviewed_level { 4 }
    rationale { 'Strong evidence.' }
    reviewed_by { 1 }
    reviewed_at { Time.current }
    overridden_by { 1 }
    overridden_at { Time.current }
  end
end
