# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    role_title { Faker::Job.title }
    created_by { 1 }

    transient do
      organization { nil }
    end

    tenant_id { organization&.id || create(:organization).id }
  end
end

