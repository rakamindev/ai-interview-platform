# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    tenant_id      { 1 }
    created_by     { 1 }
    name           { 'Frontend Developer Test' }
    time_limit_min { 10 }
    language       { 'id' }
  end
end
