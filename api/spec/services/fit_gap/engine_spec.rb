# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine, type: :service do
  let(:tenant_id) { TenantHelper::DEFAULT_TENANT_ID }

  let(:portfolio) do
    create(:portfolio, generation_status: "complete")
  end

  let(:vacancy) { create(:vacancy) }

  def build_portfolio_skill(label, level, skill_id: nil)
    create(:portfolio_skill,
           portfolio: portfolio,
           skill_label: label,
           skill_id: skill_id,
           ai_level: level)
  end

  def build_vacancy_skill(label, level, skill_id: nil)
    create(:vacancy_skill,
           vacancy: vacancy,
           skill_label: label,
           skill_id: skill_id,
           expected_level: level)
  end

  describe "#call" do
    it "classifies match when candidate meets expectation" do
      build_vacancy_skill("Ruby", 3, skill_id: "sk-001")
      build_portfolio_skill("Ruby", 3, skill_id: "sk-001")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["result"]).to eq("match")
      expect(comparison["delta"]).to eq(0)
    end

    it "classifies gap when candidate is below expectation" do
      build_vacancy_skill("Java", 4, skill_id: "sk-002")
      build_portfolio_skill("Java", 2, skill_id: "sk-002")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["result"]).to eq("gap")
      expect(comparison["delta"]).to eq(-2)
    end

    it "classifies exceed when candidate surpasses expectation" do
      build_vacancy_skill("Leadership", 2, skill_id: "sk-003")
      build_portfolio_skill("Leadership", 5, skill_id: "sk-003")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["result"]).to eq("exceed")
      expect(comparison["delta"]).to eq(3)
    end

    it "classifies not_assessed when candidate has no matching skill" do
      build_vacancy_skill("Kubernetes", 3, skill_id: "sk-004")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["result"]).to eq("not_assessed")
      expect(comparison["candidate_level"]).to be_nil
      expect(comparison["delta"]).to be_nil
    end

    it "matches by label when skill_id differs but label matches" do
      build_vacancy_skill("React", 3, skill_id: "sk-005")
      build_portfolio_skill("React", 4, skill_id: "sk-999")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["result"]).to eq("exceed")
    end

    it "applies assessor override as effective level" do
      skill = build_portfolio_skill("Docker", 1, skill_id: "sk-006")
      create(:assessor_override, portfolio_skill: skill, ai_level: 1, override_level: 5)
      build_vacancy_skill("Docker", 3, skill_id: "sk-006")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      comparison = report.skill_comparisons.first
      expect(comparison["candidate_level"]).to eq(5)
      expect(comparison["result"]).to eq("exceed")
    end

    it "stores narratives from gemini response" do
      build_vacancy_skill("SQL", 3, skill_id: "sk-007")
      build_portfolio_skill("SQL", 3, skill_id: "sk-007")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      expect(report.culture_narrative).to eq("Strong culture fit.")
      expect(report.overall_narrative).to eq("Hire recommended.")
    end

    it "falls back to a deterministic summary narrative when gemini fails" do
      build_vacancy_skill("SQL", 3, skill_id: "sk-008")
      build_portfolio_skill("SQL", 3, skill_id: "sk-008")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(RuntimeError.new("upstream down"))
      ).call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to match(/1 skill matches/)
    end

    it "falls back when gemini returns malformed JSON" do
      build_vacancy_skill("SQL", 3, skill_id: "sk-009")
      build_portfolio_skill("SQL", 3, skill_id: "sk-009")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client("{ not valid json")
      ).call

      expect(report.overall_narrative).to match(/skill matches/)
    end

    it "records a provenance_token on the report" do
      build_vacancy_skill("Ruby", 3, skill_id: "sk-010")
      build_portfolio_skill("Ruby", 3, skill_id: "sk-010")

      report = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: fake_gemini_client(narrative_payload)
      ).call

      expect(report.provenance_token).to eq(FitGap::Engine.fingerprint(portfolio, vacancy))
    end

    it "does not create duplicate reports for the same portfolio/vacancy pair" do
      build_vacancy_skill("Ruby", 3, skill_id: "sk-011")
      build_portfolio_skill("Ruby", 3, skill_id: "sk-011")

      2.times do
        described_class.new(
          portfolio: portfolio,
          vacancy: vacancy,
          gemini_client: fake_gemini_client(narrative_payload)
        ).call
      end

      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end
  end

  describe ".fingerprint" do
    it "is stable for identical inputs" do
      build_vacancy_skill("Ruby", 3, skill_id: "sk-012")
      build_portfolio_skill("Ruby", 3, skill_id: "sk-012")

      expect(described_class.fingerprint(portfolio, vacancy))
        .to eq(described_class.fingerprint(portfolio, vacancy))
    end

    it "changes when the vacancy expected_level changes" do
      build_vacancy_skill("Ruby", 3, skill_id: "sk-013")
      build_portfolio_skill("Ruby", 3, skill_id: "sk-013")

      before_value = described_class.fingerprint(portfolio, vacancy)

      vacancy.vacancy_skills.first.update!(expected_level: 4)

      expect(described_class.fingerprint(portfolio, vacancy)).not_to eq(before_value)
    end

    it "changes when a portfolio skill level changes" do
      skill = build_portfolio_skill("Ruby", 3, skill_id: "sk-014")
      build_vacancy_skill("Ruby", 3, skill_id: "sk-014")

      before_value = described_class.fingerprint(portfolio, vacancy)

      skill.update!(ai_level: 2)

      expect(described_class.fingerprint(portfolio, vacancy)).not_to eq(before_value)
    end

    it "changes when an assessor override is added" do
      skill = build_portfolio_skill("Ruby", 3, skill_id: "sk-015")
      build_vacancy_skill("Ruby", 3, skill_id: "sk-015")

      before_value = described_class.fingerprint(portfolio, vacancy)

      create(:assessor_override, portfolio_skill: skill, ai_level: 3, override_level: 5)

      expect(described_class.fingerprint(portfolio, vacancy)).not_to eq(before_value)
    end
  end

  def narrative_payload
    {
      "culture_narrative" => "Strong culture fit.",
      "overall_narrative" => "Hire recommended."
    }
  end
end