# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy, strategy: :create
    skill_comparisons { [] }
    culture_narrative { "A test culture narrative." }
    overall_narrative { "A test overall narrative." }
  end
end
