# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:role_title) { |n| "Role #{n}" }
    culture_dimensions { 'Collaborative, ownership-driven.' }
    competency_expectations { 'Strong communication and problem solving.' }
  end
end
