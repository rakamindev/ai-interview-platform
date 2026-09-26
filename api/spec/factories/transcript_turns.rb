# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'candidate' }
    text { 'I split the page into small parts and measured each one.' }
  end
end
