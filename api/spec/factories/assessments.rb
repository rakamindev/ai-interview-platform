# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id { 0 }
    created_by { 1 }
    name { "Assessment #{SecureRandom.hex(3)}" }
    time_limit_min { 30 }
  end
end
