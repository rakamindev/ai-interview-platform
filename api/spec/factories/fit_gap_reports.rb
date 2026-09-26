# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons do
      [{ "skill_label" => "React", "required_level" => 3, "candidate_level" => 3, "result" => "match" }]
    end
  end
end
