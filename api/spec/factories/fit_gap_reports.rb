# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ 'skill' => 'Ruby', 'fit' => 'match' }] }
  end
end
