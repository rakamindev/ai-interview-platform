# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    candidate_id { nil }
    generation_status { 'pending' }
    generated_at { nil }
    generation_error { nil }

    trait :complete do
      generation_status { 'complete' }
      generated_at { Time.current }
    end

    trait :generating do
      generation_status { 'generating' }
    end

    trait :failed do
      generation_status { 'failed' }
      generation_error { 'API error' }
    end
  end
end
