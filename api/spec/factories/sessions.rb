# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    tenant_id { 1 }
    association :assessment
    status { 'pending' }
    sequence(:invite_token) { |n| "token#{n}" }
  end
end
