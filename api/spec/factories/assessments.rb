# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id       { organization.id }
    created_by      { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min  { 30 }
  end
end
