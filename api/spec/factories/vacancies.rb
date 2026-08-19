# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    transient do
      organization { create(:organization) }
    end

    tenant_id  { organization.id }
    created_by { 1 }
    role_title { 'Backend Engineer' }
  end
end
