# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    association :session
    sequence(:turn_number)
    speaker { 'candidate' }
    text { Faker::Lorem.sentence }
  end
end
