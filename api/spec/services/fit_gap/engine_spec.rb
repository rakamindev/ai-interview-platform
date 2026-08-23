# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, organization:) }
  let(:session)      { create(:session, assessment:) }
  let(:portfolio)    { create(:portfolio, session:, generation_status: "complete") }
  let(:vacancy)      { create(:vacancy, organization:) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:engine) { described_class.new(portfolio:, vacancy:, gemini_client:) }

  before do
    allow(gemini_client).to receive(:generate_content)
      .and_return("culture_narrative" => "ok", "overall_narrative" => "ok")
  end

  describe "a vacancy skill whose matching portfolio skill is not_assessed" do
    it "reports it as not_assessed instead of crashing on nil arithmetic" do
      create(:vacancy_skill, vacancy:, skill_id: "SK-X", skill_label: "Skill X", expected_level: 3)
      create(:portfolio_skill, :not_assessed, portfolio:, skill_id: "SK-X", skill_label: "Skill X")

      report = engine.call

      comparison = report.skill_comparisons.find { |c| c["skill_id"] == "SK-X" }
      expect(comparison["result"]).to eq("not_assessed")
      expect(comparison["candidate_level"]).to be_nil
      expect(comparison["delta"]).to be_nil
    end
  end

  describe "a vacancy skill with a real rating" do
    it "still compares normally" do
      create(:vacancy_skill, vacancy:, skill_id: "SK-Y", skill_label: "Skill Y", expected_level: 3)
      create(:portfolio_skill, portfolio:, skill_id: "SK-Y", skill_label: "Skill Y", ai_level: 4)

      report = engine.call

      comparison = report.skill_comparisons.find { |c| c["skill_id"] == "SK-Y" }
      expect(comparison["result"]).to eq("exceed")
      expect(comparison["delta"]).to eq(1)
    end
  end
end
