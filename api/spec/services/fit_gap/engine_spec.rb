# frozen_string_literal: true

require_relative "../../spec_helper"
require_relative "../../../app/services/fit_gap/engine"

RSpec.describe FitGap::Engine do
  describe "#call" do
    it "persists the JSON comparison shape, including overridden and not-assessed skills" do
      setup = build_engine_doubles do |client|
        allow(client).to receive(:generate_content).and_return(
          "culture_narrative" => "Stubbed culture narrative",
          "overall_narrative" => "Stubbed overall narrative"
        )
      end

      setup.fetch(:engine).call

      expect(setup.fetch(:gemini_client)).to have_received(:generate_content).once
      expect(setup.fetch(:saved_attributes).fetch(:skill_comparisons)).to contain_exactly(
        include(
          "skill_label" => "Backend Engineering",
          "candidate_level" => 4,
          "expected_level" => 3,
          "delta" => 1,
          "result" => "exceed",
          "overridden" => true,
          "skill_id" => "skill-overridden",
          "confidence" => "medium"
        ),
        include(
          "skill_label" => "Testing",
          "candidate_level" => 3,
          "expected_level" => 4,
          "delta" => -1,
          "result" => "gap",
          "overridden" => false,
          "skill_id" => "skill-covered",
          "confidence" => "high"
        ),
        include(
          "skill_label" => "Cloud Security",
          "candidate_level" => nil,
          "expected_level" => 2,
          "delta" => nil,
          "result" => "not_assessed",
          "overridden" => false,
          "skill_id" => "skill-not-assessed",
          "confidence" => nil
        )
      )
    end

    it "saves unchanged comparisons and fallback narrative when Gemini raises" do
      setup = build_engine_doubles do |client|
        allow(client).to receive(:generate_content).and_raise(StandardError, "Gemini unavailable")
      end

      setup.fetch(:engine).call

      expect(setup.fetch(:gemini_client)).to have_received(:generate_content).once
      expect(setup.fetch(:saved_attributes).fetch(:skill_comparisons)).to contain_exactly(
        include(
          "skill_label" => "Backend Engineering",
          "candidate_level" => 4,
          "expected_level" => 3,
          "delta" => 1,
          "result" => "exceed",
          "overridden" => true,
          "skill_id" => "skill-overridden",
          "confidence" => "medium"
        ),
        include(
          "skill_label" => "Testing",
          "candidate_level" => 3,
          "expected_level" => 4,
          "delta" => -1,
          "result" => "gap",
          "overridden" => false,
          "skill_id" => "skill-covered",
          "confidence" => "high"
        ),
        include(
          "skill_label" => "Cloud Security",
          "candidate_level" => nil,
          "expected_level" => 2,
          "delta" => nil,
          "result" => "not_assessed",
          "overridden" => false,
          "skill_id" => "skill-not-assessed",
          "confidence" => nil
        )
      )
      expect(setup.fetch(:saved_attributes)).to include(
        culture_narrative: nil,
        overall_narrative: "Candidate shows 0 skill matches, 1 exceeds, and 1 gaps against role requirements."
      )
    end
  end

  def build_engine_doubles
    allow(Time).to receive(:current).and_return(Time.utc(2026, 1, 1))

    overridden_skill = double(
      "PortfolioSkill",
      id: 1,
      skill_id: "skill-overridden",
      skill_label: "Backend Engineering",
      ai_level: 2,
      ai_confidence: "medium",
      assessor_override: double("AssessorOverride", override_level: 4)
    )
    ordinary_skill = double(
      "PortfolioSkill",
      id: 2,
      skill_id: "skill-covered",
      skill_label: "Testing",
      ai_level: 3,
      ai_confidence: "high",
      assessor_override: nil
    )
    portfolio_skills = double("PortfolioSkills")
    allow(portfolio_skills).to receive(:includes)
      .with(:assessor_override)
      .and_return([overridden_skill, ordinary_skill])

    assessment = double("Assessment", name: "DEV Test Assessment")
    session = double("Session", assessment: assessment)
    portfolio = double(
      "Portfolio",
      id: 10,
      session: session,
      portfolio_skills: portfolio_skills
    )

    vacancy_skills = [
      double(
        "VacancySkill",
        skill_id: "skill-overridden",
        skill_label: "Backend Engineering",
        expected_level: 3
      ),
      double(
        "VacancySkill",
        skill_id: "skill-covered",
        skill_label: "Testing",
        expected_level: 4
      ),
      double(
        "VacancySkill",
        skill_id: "skill-not-assessed",
        skill_label: "Cloud Security",
        expected_level: 2
      )
    ]
    vacancy = double(
      "Vacancy",
      id: 20,
      role_title: "DEV Test Role",
      culture_dimensions: nil,
      competency_expectations: nil,
      vacancy_skills: vacancy_skills
    )

    gemini_client = double("GeminiClient")
    yield gemini_client

    saved_attributes = {}
    report = double("FitGapReport")
    allow(report).to receive(:update!) do |attributes|
      saved_attributes.merge!(
        attributes.merge(
          skill_comparisons: JSON.parse(attributes.fetch(:skill_comparisons).to_json)
        )
      )
    end

    report_class = Class.new
    allow(report_class).to receive(:find_or_initialize_by)
      .with(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
      .and_return(report)
    stub_const("FitGapReport", report_class)

    logger = double("RailsLogger", info: nil, error: nil)
    stub_const("Rails", double("Rails", logger: logger))

    {
      engine: described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: gemini_client
      ),
      gemini_client: gemini_client,
      saved_attributes: saved_attributes
    }
  end
end
