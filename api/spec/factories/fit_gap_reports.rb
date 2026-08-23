FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons do
      [{
        'skill_label' => 'Ruby',
        'candidate_level' => 3,
        'required_level' => 4,
        'fit_result' => 'gap',
        'delta' => -1
      }]
    end
  end
end
