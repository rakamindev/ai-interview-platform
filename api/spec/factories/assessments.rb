# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    name { "#{Faker::Job.title} Assessment" }
    time_limit_min { 30 }
    language { 'en' }
    created_by { 1 }

    transient do
      organization { nil }
    end

    tenant_id { organization&.id || create(:organization).id }
  end
end

