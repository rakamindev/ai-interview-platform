# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy
    generated_at { Time.current }
    skill_comparisons do
      [
        {
          'skill_label' => 'React Core',
          'candidate_level' => 3,
          'expected_level' => 3,
          'required_level' => 3,
          'result' => 'match',
          'delta' => 0,
          'is_override' => false,
          'confidence' => 'high'
        },
        {
          'skill_label' => 'System Design',
          'candidate_level' => 3,
          'expected_level' => 4,
          'required_level' => 4,
          'result' => 'gap',
          'delta' => -1,
          'is_override' => false,
          'confidence' => 'high'
        }
      ]
    end
    culture_narrative { "Candidate matches technical depth and culture expectations." }
    overall_narrative { "Strong candidate with solid foundations across frontend and system architecture." }
  end
end
