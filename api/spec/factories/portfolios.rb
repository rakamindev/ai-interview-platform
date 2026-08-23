# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { 'complete' }
    sequence(:candidate_id) { |n| n }
  end
end

