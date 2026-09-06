# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    association :assessment
    status { 'pending' }
  end
end
