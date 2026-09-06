# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    association :session
    generation_status { 'complete' }

    transient do
      tenant_id { nil }
    end

    after(:build) do |portfolio, evaluator|
      if portfolio.has_attribute?(:tenant_id)
        portfolio.tenant_id = evaluator.tenant_id || portfolio.session&.tenant_id
      end
    end
  end
end
