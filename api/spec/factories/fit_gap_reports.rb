# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy

    skill_comparisons do
      [
        {
          'skill_label' => 'React / Frontend Development Core',
          'skill_id' => nil,
          'candidate_level' => 3,
          'expected_level' => 3,
          'result' => 'match',
          'delta' => 0,
          'confidence' => 'medium',
          'is_override' => false
        }
      ]
    end
  end
end
