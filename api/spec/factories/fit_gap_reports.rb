FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ 'skill_label' => 'Ruby', 'required_level' => 3, 'ai_level' => 4, 'fit_result' => 'exceed' }] }
    trigger_reason { 'initial_generation' }
  end
end
