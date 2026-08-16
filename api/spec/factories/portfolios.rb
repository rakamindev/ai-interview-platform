# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    candidate_id { 1 }
    generation_status { 'complete' }
    generated_at { Time.current }
  end
end
