# frozen_string_literal: true

FactoryBot.define do
  factory :membership do
    user
    organization
    role { "user" }

    trait :admin do
      role { "admin" }
    end

    trait :assessor do
      role { "assessor" }
    end
  end
end
