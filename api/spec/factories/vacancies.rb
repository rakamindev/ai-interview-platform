# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { association(:organization).id }
    created_by { association(:user).id }
    sequence(:role_title) { |n| "Vacancy #{n}" }
  end
end
