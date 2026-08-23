# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ skill_label: 'Test', result: 'match' }] }
    culture_narrative { 'Good culture fit.' }
    overall_narrative { 'Strong candidate.' }
    generated_at { Time.current }
  end
end
