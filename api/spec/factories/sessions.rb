# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id { assessment.tenant_id }
    status { 'active' }
    started_at { Time.current }
  end
end
