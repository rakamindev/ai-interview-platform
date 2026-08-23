# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { "candidate" }
    text { "Some answer" }
  end
end
