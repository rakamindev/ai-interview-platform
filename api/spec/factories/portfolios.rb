# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { "complete" }
    generated_at { Time.current }

    trait :pending do
      generation_status { "pending" }
      generated_at { nil }
    end

    trait :failed do
      generation_status { "failed" }
      generation_error { "Gemini API Timeout" }
    end
  end
end
