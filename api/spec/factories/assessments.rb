# frozen_string_literal: true

FactoryBot.define do
  factory :assessment do
    association :organization
    created_by { association(:user).id }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 45 }
    language { "en" }
  end
end
