# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Software Engineer #{n}" }
    tenant_id  { 1 }
    created_by { 1 }
  end
end
