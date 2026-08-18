# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    transient do
      organization { association :organization }
      creator { association :user }
    end

    tenant_id { organization.id }
    created_by { creator.id }
    sequence(:name) { |n| "Backend Engineer Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
  end
end
