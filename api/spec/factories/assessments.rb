# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    sequence(:name) { |n| "Frontend Engineer Interview #{n}" }
    time_limit_min { 45 }
    created_by { create(:user).id }
    tenant_id { create(:organization).id }
  end
end
