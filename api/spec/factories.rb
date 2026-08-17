# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { 'Test Corp' }
    sequence(:scheme) { |n| "test-corp-#{n}" }
    identifier { 'test' }
    host { 'localhost' }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { 'en' }
    tenant_id { create(:organization).id }
    created_by { 1 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_id) { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
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
    assessment
    tenant_id { assessment.tenant_id }
    status { 'ended' }
    end_reason { 'manual_candidate' }
    candidate_name { 'Candidate A' }
  end

  factory :portfolio do
    session
    candidate_id { session.candidate_id }
    generation_status { 'complete' }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_id) { |n| "sk-eng-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Skill #{n}" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { 'high' }
    evidence { ['Candidate demonstrated this.'] }
    counter_evidence { [] }
    competency_summary { 'Summary of demonstrated competency.' }
  end

  factory :vacancy do
    tenant_id { create(:organization).id }
    created_by { 1 }
    sequence(:role_title) { |n| "Role #{n}" }
  end

  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ 'skill_id' => 'sk-1', 'result' => 'match' }] }
    culture_narrative { 'Culture narrative.' }
    overall_narrative { 'Overall narrative.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { 'Human reassessment based on evidence.' }
    overridden_by { 1 }
  end
end
