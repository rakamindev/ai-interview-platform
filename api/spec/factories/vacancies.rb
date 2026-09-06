# frozen_string_literal: true

FactoryBot.define do
  factory :vacancy do
    sequence(:role_title) { |n| "Backend Engineer #{n}" }
    culture_dimensions      { 'Agile, ownership' }
    competency_expectations { 'Strong API design, Ruby on Rails' }
  end
end
