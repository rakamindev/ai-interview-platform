# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    association :organization, strategy: :create
    created_by { association(:user).id }
    sequence(:role_title) { |n| "Vacancy #{n}" }
  end
end
