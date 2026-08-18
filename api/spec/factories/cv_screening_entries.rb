# frozen_string_literal: true

FactoryBot.define do
  factory :cv_screening_entry do
    association :cv_screening_batch
    tenant_id { cv_screening_batch.tenant_id }
  end
end
