# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    tenant_id { 1 }
    created_by { 1 }
    sequence(:role_title) { |n| "Backend Engineer #{n}" }
    culture_dimensions { 'High ownership, async communication' }
    competency_expectations { 'System design, SQL, Ruby on Rails' }
  end
end
