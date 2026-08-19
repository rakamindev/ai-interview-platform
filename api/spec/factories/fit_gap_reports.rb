# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ 'skill_id' => 'skill-1', 'result' => 'match' }] }
  end
end
