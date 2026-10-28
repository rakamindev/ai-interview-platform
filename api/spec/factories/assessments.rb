# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Technical Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
    created_by { 1 }
    tenant_id { Current.tenant_id || 1 }
  end
end
