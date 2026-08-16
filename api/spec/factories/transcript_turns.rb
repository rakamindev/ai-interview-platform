# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'ai' }
    text { 'Hello there' }
  end
end
