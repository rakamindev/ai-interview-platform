# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    sequence(:created_by) { |n| n + 2000 }
    sequence(:role_title) { |n| "Senior Engineer #{n}" }
    culture_dimensions { 'Collaborative, results-driven, autonomous.' }
    competency_expectations { '3+ years experience, strong system design.' }

    trait :with_skills do
      after(:create) do |vacancy|
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', skill_id: 'sk-1', expected_level: 3)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby', skill_id: 'sk-2', expected_level: 4)
      end
    end
  end
end
