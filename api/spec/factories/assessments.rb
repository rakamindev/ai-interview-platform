# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    name { "Test Role" }
    time_limit_min { 45 }
    tenant_id { organization.id }
    created_by { create(:user, organization:).id }
  end
end