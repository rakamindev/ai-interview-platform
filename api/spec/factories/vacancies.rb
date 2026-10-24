# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Senior Frontend Engineer #{n}" }
    created_by { create(:user).id }
    tenant_id { create(:organization).id }
    culture_dimensions { 'Ownership, direct feedback, and collaboration.' }
    competency_expectations { 'Ships end-to-end features with measurable impact.' }
  end
end
