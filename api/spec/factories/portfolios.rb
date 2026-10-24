# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at { Time.current }
  end
end
