# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    transient do
      organization { association(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:role_title) { |n| "Role #{n}" }
  end
end
