# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ skill_label: 'React', result: 'match', candidate_level: 3, expected_level: 3, delta: 0 }] }
    culture_narrative { 'Strong culture fit.' }
    overall_narrative { 'Recommended for hire.' }
    generated_at { Time.current }
  end
end
