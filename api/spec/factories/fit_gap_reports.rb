# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ 'skill_label' => 'React', 'result' => 'match', 'expected_level' => 3 }] }
    overall_narrative { 'Candidate matches the role.' }
    generated_at { Time.current }
  end
end
