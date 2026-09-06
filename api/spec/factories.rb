# frozen_string_literal: true

# Factories for the AI interview domain.
#
# Two things to know before adding to this file:
#
# 1. `tenant_id` is normally assigned by TenantScoped from Current.tenant_id,
#    which specs do not populate. Every tenant-scoped factory therefore takes an
#    explicit `tenant_id` so a spec can create records in two tenants at once
#    without touching request-scoped state.
#
# 2. Candidate data is fictional by construction. The brief disqualifies
#    committing real personal data, and UU PDP applies to interview transcripts
#    and character judgements, so nothing here may be copied from a real session.
FactoryBot.define do
  factory :organization do
    sequence(:name)       { |n| "Test Corp #{n}" }
    sequence(:scheme)     { |n| "test-corp-#{n}" }
    sequence(:identifier) { |n| "test-corp-#{n}" }
    sequence(:host)       { |n| "tenant-#{n}.example.test" }
  end

  factory :assessment do
    tenant_id      { 1 }
    created_by     { 1 }
    name           { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language       { 'en' }
  end

  factory :assessment_skill do
    assessment
    skill_id      { 'SK-ENG-001' }
    skill_label   { 'React / Frontend Development Core' }
    l1_anchor     { 'Implements components from specs with close review.' }
    l2_anchor     { 'Builds routine features independently.' }
    l3_anchor     { 'Designs and builds complex features end-to-end.' }
    l4_anchor     { 'Defines frontend standards for the team.' }
    l5_anchor     { 'Defines frontend architecture strategy for the org.' }
    expected_level { 3 }
    display_order  { 0 }
  end

  factory :session do
    tenant_id      { 1 }
    assessment
    candidate_name { 'Ahmad Rizky' } # fictional
    status         { 'ended' }
    end_reason     { 'manual_assessor' }
    started_at     { 45.minutes.ago }
    ended_at       { 7.minutes.ago }
    duration_seconds { 2_280 }
  end

  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    skill_id           { 'SK-ENG-001' }
    skill_label        { 'React / Frontend Development Core' }
    is_discovered      { false }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['I split the context into a read-only and a write provider.'] }
    competency_summary { 'Handles complex state architecture with clear tradeoff reasoning.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { 2 }
    override_level { 3 }
    assessor_notes { 'Listened back to this section; the anchor puts this at L3.' }
    overridden_by  { 1 }
    overridden_at  { Time.current }
  end

  factory :vacancy do
    tenant_id  { 1 }
    created_by { 1 }
    role_title { 'Senior Frontend Engineer (TechCorp)' }
  end

  factory :vacancy_skill do
    vacancy
    skill_id       { 'SK-ENG-001' }
    skill_label    { 'React / Frontend Development Core' }
    expected_level { 3 }
  end

  factory :coverage_map do
    session
    skill_id      { 'SK-ENG-001' }
    skill_label   { 'React / Frontend Development Core' }
    is_discovered { false }
    state         { 'covered' }
    probe_count   { 5 }
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text    { 'We moved real-time data into local state with useRef.' }
  end
end
