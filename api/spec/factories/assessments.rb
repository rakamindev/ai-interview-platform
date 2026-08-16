# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
  end
end
