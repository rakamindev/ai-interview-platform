# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name { "Acme Corp" }
    sequence(:scheme) { |n| "acme-corp-#{n}" }
    sequence(:identifier) { |n| "acme-corp-#{n}" }
    host { "localhost" }
  end

  factory :user do
    sequence(:email) { |n| "assessor#{n}@acme.com" }
    password { "Password123!" }
    role { "admin" }
  end

  factory :assessment do
    sequence(:name) { |n| "Fullstack Engineer Assessment #{n}" }
    time_limit_min { 30 }
    language { "en" }
    tenant_id { 1 }
    created_by { 1 }

    after(:build) do |assessment|
      if assessment.assessment_skills.empty?
        assessment.assessment_skills << build(:assessment_skill, assessment: assessment, skill_label: "Ruby on Rails", expected_level: 3, display_order: 1)
        assessment.assessment_skills << build(:assessment_skill, assessment: assessment, skill_label: "React / Frontend", expected_level: 3, display_order: 2)
      end
    end
  end

  factory :assessment_skill do
    association :assessment
    skill_label { "Ruby on Rails" }
    expected_level { 3 }
    display_order { 1 }
    l1_anchor { "Basic understanding of MVC" }
    l2_anchor { "Builds standard controllers and models" }
    l3_anchor { "Designs complex business logic and optimizes queries" }
    l4_anchor { "Architects services and defines standards" }
    l5_anchor { "Org-wide technical authority" }
  end

  factory :session do
    association :assessment
    tenant_id { 1 }
    candidate_name { "Budi Santoso" }
    status { "ended" }
    end_reason { "manual_assessor" }
    started_at { 30.minutes.ago }
    ended_at { Time.current }
    duration_seconds { 1800 }
  end

  factory :portfolio do
    association :session
    generation_status { "complete" }
    generated_at { Time.current }
  end

  factory :portfolio_skill do
    association :portfolio
    skill_label { "Ruby on Rails" }
    is_discovered { false }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Candidate discussed ActiveRecord transaction boundaries effectively."] }
    competency_summary { "Demonstrates solid proficiency in Rails backend architectures." }
  end

  factory :assessor_override do
    association :portfolio_skill
    ai_level { 3 }
    override_level { 4 }
    assessor_notes { "Exhibited L4 systems understanding in deep architectural follow-up." }
    overridden_by { 1 }
  end

  factory :vacancy do
    sequence(:role_title) { |n| "Senior Fullstack Engineer #{n}" }
    tenant_id { 1 }
    created_by { 1 }
    culture_dimensions { "Autonomous, collaborative, high craftsmanship" }
    competency_expectations { "Expected to lead technical discussions and review architecture." }

    after(:build) do |vacancy|
      if vacancy.vacancy_skills.empty?
        vacancy.vacancy_skills << build(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby on Rails", expected_level: 3)
        vacancy.vacancy_skills << build(:vacancy_skill, vacancy: vacancy, skill_label: "System Design", expected_level: 4)
      end
    end
  end

  factory :vacancy_skill do
    association :vacancy
    skill_label { "Ruby on Rails" }
    expected_level { 3 }
  end
end
