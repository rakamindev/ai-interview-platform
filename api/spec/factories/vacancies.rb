# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    role_title { Faker::Job.title }
    culture_dimensions { Faker::Lorem.paragraph }
    competency_expectations { Faker::Lorem.paragraph }
  end
end
