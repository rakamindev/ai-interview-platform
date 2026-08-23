# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:role_title) { |n| "Senior Architect #{n}" }
    culture_dimensions { "High agency, fast execution, direct feedback" }
    competency_expectations { "Distributed systems, fault tolerance, scalability" }

    trait :with_skills do
      after(:create) do |vacancy|
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'React Core', expected_level: 3)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 4)
      end
    end
  end
end
