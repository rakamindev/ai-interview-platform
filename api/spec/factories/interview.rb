# frozen_string_literal: true

# All personal data here is fictional. Never put real candidate data in specs.
FactoryBot.define do
  factory :organization do
    sequence(:scheme) { |n| "tenant-#{n}" }
    name       { scheme.titleize }
    identifier { scheme }
    host       { "#{scheme}.test" }
  end

  factory :assessment do
    transient { organization { create(:organization) } }
    tenant_id      { organization.id }
    created_by     { 1 }
    name           { 'Frontend Engineer' }
    time_limit_min { 30 }
  end

  factory :session do
    assessment
    tenant_id      { assessment.tenant_id }
    status         { 'ended' }
    candidate_name { 'Kandidat Fiktif' }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label        { "Skill #{skill_id}" }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['Quote from a fictional candidate'] }
    competency_summary { 'Consistent, evidence-backed behaviour at this level.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 4 }
    assessor_notes { 'Verified in follow-up' }
    overridden_by  { 1 }
  end

  factory :vacancy do
    transient { organization { create(:organization) } }
    tenant_id  { organization.id }
    created_by { 1 }
    role_title { 'Senior Frontend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_id) { |n| "sk-#{n}" }
    skill_label    { "Skill #{skill_id}" }
    expected_level { 3 }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    status { 'complete' }
    skill_comparisons do
      [{ 'skill_label' => 'Communication', 'expected_level' => 3, 'candidate_level' => 2, 'result' => 'gap', 'delta' => -1 }]
    end
  end
end
