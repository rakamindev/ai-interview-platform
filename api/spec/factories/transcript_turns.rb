# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    association :session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'This is a test transcript turn.' }

    trait :ai do
      speaker { 'ai' }
    end

    trait :candidate do
      speaker { 'candidate' }
    end
  end
end
