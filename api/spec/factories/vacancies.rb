# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    transient do
      organization { association :organization }
    end

    tenant_id  { organization.id }
    created_by { 1 }
    role_title { 'Contoh Backend Engineer' }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Contoh Skill #{n}" }
    expected_level { 3 }
  end
end
