FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons { [{ "skill_label" => "Backend", "fit_result" => "match" }] }
    culture_narrative { "Strong culture fit narrative." }
    overall_narrative { "Overall strong candidate." }
  end
end
