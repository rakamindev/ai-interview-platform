# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Org #{n}" }
    sequence(:scheme)     { |n| "org#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host)       { |n| "org#{n}.example.test" }
  end

  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id      { organization.id }
    created_by     { 1 }
    name           { 'Backend Interview' }
    time_limit_min { 30 }
  end

  factory :session do
    transient do
      organization { create(:organization) }
    end

    tenant_id  { organization.id }
    assessment { create(:assessment, organization: organization) }
    sequence(:invite_token) { |n| "token-#{n}-#{SecureRandom.hex(8)}" }
    status { 'ended' }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'candidate' }
    text    { 'I have five years of Ruby experience.' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id)    { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { [] }
    competency_summary { 'Solid fundamentals.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { 3 }
    override_level { 4 }
    overridden_by  { 1 }
  end

  factory :vacancy do
    transient do
      organization { create(:organization) }
    end

    tenant_id  { organization.id }
    created_by { 1 }
    role_title { 'Backend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id)    { |n| "skill-#{n}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ skill_label: 'Ruby', required_level: 3, candidate_level: 3, result: 'match', delta: 0 }] }
  end
end