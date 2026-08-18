require_relative "../../spec_helper"
require_relative "../../../app/services/fit_gap/comparator"

RSpec.describe FitGap::Comparator do
  it "matches labels without changing the required-level contract" do
    result = described_class.new(
      portfolio_skills: [{ skill_id: nil, skill_label: " React  ", effective_level: 4, confidence: "high", overridden: false, rating_status: "rated" }],
      vacancy_skills: [{ skill_id: nil, skill_label: "react", expected_level: 3 }]
    ).call

    expect(result).to include(
      hash_including(
        skill_label: "react",
        required_level: 3,
        candidate_level: 4,
        result: "exceed",
        delta: 1,
        is_override: false
      )
    )
  end

  it "keeps a matched skill not assessed when it has no reliable rating" do
    result = described_class.new(
      portfolio_skills: [{ skill_id: "ruby", skill_label: "Ruby", effective_level: nil, confidence: "low", overridden: false, rating_status: "not_assessed" }],
      vacancy_skills: [{ skill_id: "ruby", skill_label: "Ruby", expected_level: 3 }]
    ).call

    expect(result.first).to include(
      candidate_level: nil,
      result: "not_assessed",
      delta: nil,
      rating_status: "not_assessed"
    )
  end

  it "marks an assessor override as the source of the candidate level" do
    result = described_class.new(
      portfolio_skills: [{ skill_id: "react", skill_label: "React", effective_level: 2, confidence: "low", overridden: true, rating_status: "rated" }],
      vacancy_skills: [{ skill_id: "react", skill_label: "React", expected_level: 2 }]
    ).call

    expect(result.first).to include(is_override: true, result: "match")
  end
end
