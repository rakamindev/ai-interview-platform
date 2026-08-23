# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min  { 30 }
    created_by      { 1 }
    tenant_id       { Current.tenant_id }
  end
end
