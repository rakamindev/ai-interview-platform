# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { organization.id }
    created_by { 1 }
    role_title { 'Senior Backend Engineer' }

    transient do
      organization { create(:organization) }
    end
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
