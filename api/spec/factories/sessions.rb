# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 0 }
    association :assessment
    status { "active" }
  end
end
