# frozen_string_literal: true

require "rails_helper"
require_relative "../../../app/services/fit_gap/comparison_builder"

RSpec.describe FitGap::ComparisonBuilder do
  def portfolio_skill(
    skill_id:,
    skill_label:,
    level:,
    confidence: "high",
    evidence: ["Candidate example"],
    override_level: nil
  )
    override = override_level && double("AssessorOverride", override_level: override_level)

    double(
      "PortfolioSkill",
      id: skill_id || skill_label,
      skill_id: skill_id,
      skill_label: skill_label,
      ai_level: level,
      ai_confidence: confidence,
      evidence_quotes: evidence,
      assessor_override: override
    )
  end

  def vacancy_skill(skill_id:, skill_label:, expected_level:)
    double(
      "VacancySkill",
      skill_id: skill_id,
      skill_label: skill_label,
      expected_level: expected_level
    )
  end

  def build_builder(portfolio_skills:, vacancy_skills:)
    portfolio_skill_relation = double("PortfolioSkills")
    allow(portfolio_skill_relation)
      .to receive(:includes)
      .with(:assessor_override)
      .and_return(portfolio_skills)

    portfolio = double("Portfolio", portfolio_skills: portfolio_skill_relation)
    vacancy = double("Vacancy", vacancy_skills: vacancy_skills)

    described_class.new(portfolio: portfolio, vacancy: vacancy)
  end

  it "returns canonical comparisons and summary counts" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(skill_id: "react", skill_label: "React", level: 3),
        portfolio_skill(skill_id: "typescript", skill_label: "TypeScript", level: 4),
        portfolio_skill(skill_id: "communication", skill_label: "Communication", level: 2)
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: "react", skill_label: "React", expected_level: 3),
        vacancy_skill(skill_id: "typescript", skill_label: "TypeScript", expected_level: 3),
        vacancy_skill(skill_id: "communication", skill_label: "Communication", expected_level: 3),
        vacancy_skill(skill_id: "ruby", skill_label: "Ruby", expected_level: 2)
      ]
    ).call

    expect(result[:skill_comparisons]).to include(
      hash_including(
        skill_label: "React",
        expected_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
        confidence: "high",
        is_override: false,
        caveat: nil
      ),
      hash_including(
        skill_label: "TypeScript",
        candidate_level: 4,
        result: "exceed",
        delta: 1
      ),
      hash_including(
        skill_label: "Communication",
        candidate_level: 2,
        result: "gap",
        delta: -1
      ),
      hash_including(
        skill_label: "Ruby",
        candidate_level: nil,
        result: "not_assessed",
        delta: nil,
        caveat: "No usable evidence"
      )
    )

    expect(result[:summary]).to include(
      match_count: 1,
      exceed_count: 1,
      gap_count: 1,
      not_assessed_count: 1,
      priority_gaps: ["Communication"]
    )
    expect(result[:caveats]).to include("1 required skill has no usable evidence.")
  end

  it "treats a matched skill without evidence as not assessed" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(
          skill_id: "react",
          skill_label: "React",
          level: 4,
          evidence: []
        )
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: "react", skill_label: "React", expected_level: 3)
      ]
    ).call

    comparison = result[:skill_comparisons].first

    expect(comparison).to include(
      candidate_level: nil,
      result: "not_assessed",
      delta: nil,
      confidence: nil,
      caveat: "No usable evidence"
    )
  end

  it "uses override level and exposes human provenance" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(
          skill_id: "react",
          skill_label: "React",
          level: 3,
          override_level: 2
        )
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: "react", skill_label: "React", expected_level: 3)
      ]
    ).call

    expect(result[:skill_comparisons].first).to include(
      candidate_level: 2,
      result: "gap",
      delta: -1,
      is_override: true
    )
  end

  it "returns non-required portfolio skills as additional signals" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(skill_id: "react", skill_label: "React", level: 3),
        portfolio_skill(
          skill_id: "graphql",
          skill_label: "GraphQL",
          level: 2,
          confidence: "low"
        )
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: "react", skill_label: "React", expected_level: 3)
      ]
    ).call

    expect(result[:additional_skill_signals]).to include(
      hash_including(
        skill_id: "graphql",
        skill_label: "GraphQL",
        candidate_level: 2,
        confidence: "low"
      )
    )
    expect(result[:caveats]).to include("1 assessed skill has low confidence.")
  end

  it "falls back to an ID-less Portfolio label for legacy records" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(skill_id: nil, skill_label: "React", level: 3)
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: "react", skill_label: "React", expected_level: 3)
      ]
    ).call

    expect(result[:skill_comparisons].first).to include(
      candidate_level: 3,
      result: "match",
      delta: 0
    )
  end

  it "does not silently choose between ambiguous label matches" do
    result = build_builder(
      portfolio_skills: [
        portfolio_skill(skill_id: nil, skill_label: "React", level: 3),
        portfolio_skill(skill_id: nil, skill_label: " react ", level: 4)
      ],
      vacancy_skills: [
        vacancy_skill(skill_id: nil, skill_label: "React", expected_level: 3)
      ]
    ).call

    expect(result[:skill_comparisons].first).to include(
      candidate_level: nil,
      result: "not_assessed",
      caveat: "Ambiguous skill match"
    )
    expect(result[:caveats]).to include("React has ambiguous Portfolio skill matches.")
  end
end
