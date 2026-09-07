# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    tenant_id { assessment.tenant_id }
    status    { 'ended' }
  end
end
