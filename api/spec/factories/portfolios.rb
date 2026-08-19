# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    sequence(:candidate_id)
    generation_status { "complete" }
  end
end
