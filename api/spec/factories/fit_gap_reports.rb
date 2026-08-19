FactoryBot.define do
  factory :fit_gap_report do
    portfolio
    vacancy
    skill_comparisons { [{ skill_label: 'Test Skill', result: 'match' }] }
  end
end
