# frozen_string_literal: true

FactoryBot.define do
  factory :fit_gap_report do
    association :portfolio
    association :vacancy
    skill_comparisons do
      [
        {
          skill_label: "Ruby",
          skill_id: nil,
          candidate_level: 3,
          expected_level: 3,
          result: "match",
          delta: 0,
          confidence: "medium",
          overridden: false
        }
      ]
    end
    source_fingerprint { "initial-fingerprint" }
  end
end
