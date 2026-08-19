require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:organization) { set_current_tenant }
  let(:vacancy) { create(:vacancy) }
  let(:session) { create(:session) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  before { organization }

  def call_engine
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
  end

  before do
    allow(gemini_client).to receive(:generate_content)
      .and_return({ "culture_narrative" => "Good fit.", "overall_narrative" => "Recommend." })
  end

  describe "skill comparison classification" do
    it "classifies as 'match' when candidate level equals expected level" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 3)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }

      expect(comparison["result"]).to eq("match")
      expect(comparison["delta"]).to eq(0)
    end

    it "classifies as 'exceed' when candidate level is above expected level" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 4)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }

      expect(comparison["result"]).to eq("exceed")
      expect(comparison["delta"]).to eq(2)
    end

    it "classifies as 'gap' when candidate level is below expected level" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 2)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }

      expect(comparison["result"]).to eq("gap")
      expect(comparison["delta"]).to eq(-2)
    end

    it "classifies as 'not_assessed' when the vacancy skill has no matching portfolio skill" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Kubernetes", expected_level: 3)
      # no matching portfolio_skill created

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Kubernetes" }

      expect(comparison["result"]).to eq("not_assessed")
      expect(comparison["candidate_level"]).to be_nil
      expect(comparison["delta"]).to be_nil
    end
  end

  describe "skill matching precedence" do
    it "matches by skill_id first, even if the labels differ" do
      create(:vacancy_skill, vacancy: vacancy, skill_id: "SK-001", skill_label: "Backend Development", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: "SK-001", skill_label: "Server-side Engineering", ai_level: 3)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Backend Development" }

      expect(comparison["result"]).to eq("match")
    end

    it "falls back to a case-insensitive label match when there is no skill_id" do
      create(:vacancy_skill, vacancy: vacancy, skill_id: nil, skill_label: "Ruby on Rails", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: "RUBY ON RAILS", ai_level: 3)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby on Rails" }

      expect(comparison["result"]).to eq("match")
    end
  end

  describe "assessor overrides" do
    it "uses the override level instead of the AI level when one exists" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 4)
      portfolio_skill = create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 2)
      create(:assessor_override, portfolio_skill: portfolio_skill, ai_level: 2, override_level: 4)

      report = call_engine
      comparison = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }

      expect(comparison["candidate_level"]).to eq(4)
      expect(comparison["result"]).to eq("match")
      expect(comparison["is_override"]).to be true
    end
  end

  describe "narrative generation failure handling" do
    it "falls back to a generated summary narrative instead of raising when the model call fails" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 3)
      allow(gemini_client).to receive(:generate_content).and_raise(StandardError, "Gemini timed out")

      report = nil
      expect { report = call_engine }.not_to raise_error

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include("1 skill matches")
    end

    it "falls back gracefully when the model returns unparsable JSON" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 3)
      allow(gemini_client).to receive(:generate_content).and_return("not valid json")

      report = nil
      expect { report = call_engine }.not_to raise_error
      expect(report.overall_narrative).to be_present
    end
  end

  describe "idempotency" do
    it "updates the existing report instead of creating a duplicate on a second call" do
      create(:vacancy_skill, vacancy: vacancy, skill_label: "Ruby", expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: "Ruby", ai_level: 3)

      first_report = call_engine
      second_report = call_engine

      expect(second_report.id).to eq(first_report.id)
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end
  end
end
