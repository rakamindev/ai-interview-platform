# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { "complete" }

    factory :portfolio_with_skill do
      after(:create) do |portfolio|
        create(:portfolio_skill, portfolio:)
      end
    end
  end
end