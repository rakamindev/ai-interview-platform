# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name       { Faker::Company.name }
    scheme     { Faker::Internet.unique.domain_word }
    identifier { scheme }
    host       { "#{scheme}.localhost" }
    alias_hosts { [] }
    config     { {} }
  end

  factory :user do
    association :organization, strategy: :build
    email           { Faker::Internet.unique.email }
    password        { "password123" }
    password_digest { BCrypt::Password.create("password123") }
    role            { "assessor" }

    # tenant_id resolved via organization in the real app, but for unit tests
    # we stub tenant resolution — this just sets up the record
  end

  factory :assessment do
    # tenant_id is required; set it explicitly in tests
    tenant_id  { 1 }
    created_by { 1 }
    name       { Faker::Job.title }
    time_limit_min { 45 }
    language   { "en" }

    trait :with_skills do
      after(:create) do |assessment|
        create(:assessment_skill, assessment: assessment)
      end
    end
  end

  factory :assessment_skill do
    association :assessment
    skill_id      { "sk-test-001" }
    skill_label   { Faker::Job.field }
    is_custom     { false }
    expected_level { 3 }
    display_order { 0 }
    l1_anchor     { "Beginner — executes with explicit guidance" }
    l2_anchor     { "Developing — executes independently on routine scope" }
    l3_anchor     { "Proficient — handles complex, ambiguous scope" }
    l4_anchor     { "Expert — defines standards and creates reusable systems" }
    l5_anchor     { "Master — org-level authority" }
  end

  factory :session do
    association :assessment
    tenant_id     { 1 }
    candidate_id  { nil }
    candidate_name { Faker::Name.name }
    invite_token  { SecureRandom.hex(32) }
    status        { "pending" }
  end

  factory :portfolio do
    association :session
    candidate_id      { nil }
    generation_status { "complete" }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    skill_id          { "sk-test-001" }
    skill_label       { Faker::Job.field }
    is_discovered     { false }
    ai_level          { 3 }
    ai_confidence     { "medium" }
    evidence          { ["Quote one from the transcript", "Quote two"] }
    competency_summary { "Candidate demonstrates solid mid-level capability." }
  end
end
