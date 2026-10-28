# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons do
      [{ 'skill_label' => 'Contoh Skill', 'expected_level' => 3, 'candidate_level' => 3,
         'result' => 'match', 'delta' => 0, 'confidence' => 'high' }]
    end
    overall_narrative { 'Contoh narasi keseluruhan.' }
    generated_at      { Time.current }
  end
end
