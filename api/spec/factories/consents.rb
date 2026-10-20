# frozen_string_literal: true

FactoryBot.define do
  factory :consent do
    session
    version     { ConsentText::VERSION }
    consented_at { Time.current }

    trait :stale do
      version { "2000-01-01-v0" }
    end
  end
end
