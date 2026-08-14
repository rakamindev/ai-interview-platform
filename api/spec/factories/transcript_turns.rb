# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    association :session
    sequence(:turn_number)
    speaker { "candidate" }
    text { "This is a sample answer." }
  end
end
