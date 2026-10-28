# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:fake_client) { instance_double(Gemini::HttpClient) }

  def build_portfolio_with_vacancy
    portfolio = nil
    vacancy = nil
    with_tenant(1) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment)
      portfolio = create(:portfolio, session: session)
      vacancy = create(:vacancy)
    end
    [portfolio, vacancy]
  end

  describe "#call — skill comparison result matrix" do
    before do
      allow(fake_client).to receive(:generate_content)
        .and_return({ "culture_narrative" => "fine", "overall_narrative" => "fine" }.to_json)
    end

    # AC-8: only assessed (or overridden) skills produce match/gap/exceed.
    # not_assessed / insufficient_evidence produce a result of their own name.
    it "is not_assessed when the vacancy wants a skill the portfolio has no row for at all" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 3)
      # no matching portfolio_skill created at all

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("not_assessed")
      expect(comparison["candidate_level"]).to be_nil
      expect(comparison["delta"]).to be_nil
    end

    it "is not_assessed, not a fabricated gap, when the portfolio skill itself is not_assessed" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "Cloud Infra", expected_level: 3)
      create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_id: "SK-1", skill_label: "Cloud Infra")

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("not_assessed")
      expect(comparison["candidate_level"]).to be_nil
      # This is the exact regression this revamp exists to prevent: an
      # unreached skill must never carry a negative delta.
      expect(comparison["delta"]).to be_nil
    end

    it "is insufficient_evidence, not a gap, for a weakly-covered skill" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "Testing", expected_level: 3)
      create(:portfolio_skill, :insufficient_evidence, portfolio: portfolio, skill_id: "SK-1", skill_label: "Testing")

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("insufficient_evidence")
      expect(comparison["delta"]).to be_nil
      expect(comparison["provisional_level"]).to eq(1) # kept, just not scored
    end

    it "is match when the assessed level equals the expected level" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 3)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("match")
      expect(comparison["delta"]).to eq(0)
    end

    it "is exceed when the assessed level is above expected" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 4)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("exceed")
      expect(comparison["delta"]).to eq(2)
    end

    it "is gap when the assessed level is below expected" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 2)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("gap")
      expect(comparison["delta"]).to eq(-2)
    end

    # An assessor override speaks for a skill even when the AI's own status
    # was not_assessed — the human judgement takes over the comparison.
    it "is scored by the override level, not not_assessed, when a human has overridden it" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "Cloud Infra", expected_level: 3)
      skill = create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_id: "SK-1", skill_label: "Cloud Infra")
      create(:assessor_override, portfolio_skill: skill, ai_level: 1, override_level: 3)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      comparison = report.skill_comparisons.first

      expect(comparison["result"]).to eq("match")
      expect(comparison["is_override"]).to be true
    end

    it "flags is_override false when no override exists" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 3)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      expect(report.skill_comparisons.first["is_override"]).to be false
    end

    # AC-12: a vacancy with zero skills produces an empty comparison list
    # and must not raise (previously: FitGapReport's presence validation on
    # skill_comparisons rejected [] as blank, raising RecordInvalid).
    it "does not raise for a vacancy with no skills configured yet" do
      portfolio, vacancy = build_portfolio_with_vacancy # no vacancy_skills created

      report = nil
      expect {
        report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      }.not_to raise_error

      expect(report.skill_comparisons).to eq([])
    end
  end

  describe "#call — narrative fallback" do
    # AC-10: fallback narrative states non-zero result counts with correct
    # singular/plural forms, including insufficient_evidence/not_assessed —
    # the old fallback only ever mentioned matches/exceeds/gaps.
    it "falls back to a narrative mentioning all non-zero result counts when Gemini fails" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-2", skill_label: "Cloud Infra", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 3)
      create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_id: "SK-2", skill_label: "Cloud Infra")

      allow(fake_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::TimeoutError.new("timeout"))

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call

      expect(report.overall_narrative).to include("1 match")
      expect(report.overall_narrative).to include("1 skill never reached in the interview")
      expect(report.culture_narrative).to be_nil
    end

    it "uses plural forms for counts greater than one" do
      portfolio, vacancy = build_portfolio_with_vacancy
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-1", skill_label: "React", expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-2", skill_label: "Testing", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-1", skill_label: "React", ai_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-2", skill_label: "Testing", ai_level: 3)

      allow(fake_client).to receive(:generate_content).and_raise(StandardError.new("boom"))

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client).call
      expect(report.overall_narrative).to include("2 matches")
    end
  end
end
