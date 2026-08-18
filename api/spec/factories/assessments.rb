# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 1 }
    created_by { 1 }
    name { 'Senior Frontend Engineer' }
    time_limit_min { 45 }
    language { 'en' }
  end
end
