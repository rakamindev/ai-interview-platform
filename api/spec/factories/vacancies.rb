# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Role #{n}" }
    tenant_id { 1 }
    created_by { 1 }
    culture_dimensions { 'Team player, ownership' }
    competency_expectations { 'Strong technical skills' }

    trait :with_skills do
      after(:create) do |vacancy|
        create_list(:vacancy_skill, 3, vacancy: vacancy)
      end
    end
  end
end
