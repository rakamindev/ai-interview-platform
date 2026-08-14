# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:role_title) { |n| "Role #{n}" }
    culture_dimensions { "Collaborative, fast-paced." }
    competency_expectations { "Strong ownership." }
  end
end
